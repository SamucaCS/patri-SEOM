import type { PrismaClient } from "@/generated/prisma/client";
import {
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SIGLA_ESCOLA_LENGTH,
} from "./config";
import { montarCodigo } from "./emissao";
import { getPrisma, getPrismaDireto } from "./prisma";

export type Problema = {
  nivel: "erro" | "aviso";
  mensagem: string;
};

/**
 * Verificacao de integridade na inicializacao.
 *
 * O que ela procura sao estados que a aplicacao nao consegue causar sozinha, mas que
 * um banco restaurado errado, uma edicao a mao ou uma migration aplicada pela metade
 * conseguem. Emitir em cima de um banco assim produz codigo torto que ninguem vai
 * conseguir corrigir depois, porque codigo nao se edita.
 */
export async function verificarIntegridade(
  client?: PrismaClient,
  clientDireto?: PrismaClient,
): Promise<Problema[]> {
  const db = client ?? getPrisma();
  const problemas: Problema[] = [];

  // 1. A conexão da emissão sustenta transação interativa com advisory lock?
  //
  //    Substitui a antiga checagem de `journal_mode = WAL`, que era do SQLite. Esta
  //    verifica a única coisa que, se estiver errada, quebra em silêncio: se a emissão
  //    sair pelo pooler em transaction mode, o `BEGIN`, o lock e o `INSERT` podem cair
  //    em backends diferentes, o lock deixa de valer para os statements seguintes, e
  //    duas emissões simultâneas voltam a ler o mesmo `MAX()`. Não dá erro — dá código
  //    de patrimônio duplicado.
  //
  //    A chave do teste é aleatória de propósito: com chave fixa, dois boots ao mesmo
  //    tempo disputariam o mesmo lock e um acusaria falha que não existe.
  const dbEmissao = clientDireto ?? client ?? getPrismaDireto();
  try {
    const chave = `boot:${Math.random().toString(36).slice(2)}`;
    await dbEmissao.$transaction(async (tx) => {
      const r = await tx.$queryRaw<Array<{ ok: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${chave})::bigint) AS ok
      `;
      if (r[0]?.ok !== true) throw new Error("o lock de teste não foi concedido");
    });
  } catch (erro) {
    problemas.push({
      nivel: "erro",
      mensagem:
        "A conexão de emissão não sustentou uma transação interativa com advisory " +
        "lock. Emitir assim pode gerar código duplicado sem dar erro. Confira se " +
        "DIRECT_URL aponta para a conexão direta (porta 5432), e não para o pooler " +
        `(6543). Detalhe: ${erro instanceof Error ? erro.message : String(erro)}`,
    });
  }

  const [escolas, classes] = await Promise.all([
    db.escola.findMany({ select: { sigla: true, nome: true, codigoCie: true } }),
    db.classe.findMany({ select: { sigla: true, nome: true } }),
  ]);

  // 2. Sigla de escola tem largura fixa: ela abre o codigo.
  for (const e of escolas) {
    if (e.sigla.length !== SIGLA_ESCOLA_LENGTH) {
      problemas.push({
        nivel: "erro",
        mensagem:
          `A escola "${e.nome}" tem sigla ${e.sigla} com ${e.sigla.length} ` +
          `caracteres; o formato exige ${SIGLA_ESCOLA_LENGTH}. Emitir para ela falha.`,
      });
    }
    if (!/^[A-Z0-9]+$/.test(e.sigla)) {
      problemas.push({
        nivel: "erro",
        mensagem: `A escola "${e.nome}" tem sigla ${e.sigla} fora do padrão maiúsculo.`,
      });
    }
  }

  // 3. Sigla de classe cabe na faixa.
  for (const c of classes) {
    if (
      c.sigla.length < SIGLA_CLASSE_MIN_LENGTH ||
      c.sigla.length > SIGLA_CLASSE_MAX_LENGTH
    ) {
      problemas.push({
        nivel: "erro",
        mensagem:
          `A classe "${c.nome}" tem sigla ${c.sigla} com ${c.sigla.length} ` +
          `caracteres; o formato aceita de ${SIGLA_CLASSE_MIN_LENGTH} a ` +
          `${SIGLA_CLASSE_MAX_LENGTH}.`,
      });
    }
  }

  // 4. CIE provisório.
  const pendentes = escolas.filter((e) => e.codigoCie.startsWith("PENDENTE"));
  if (pendentes.length > 0) {
    problemas.push({
      nivel: "aviso",
      mensagem:
        `${pendentes.length} unidade(s) ainda com código CIE provisório: ` +
        `${pendentes.map((e) => e.sigla).join(", ")}. O CIE sai na exportação.`,
    });
  }

  // 5. Todo código gravado ainda corresponde à sigla atual da escola e da classe.
  //    Se alguém alterou uma sigla direto no banco, é aqui que aparece.
  const codigos = await db.codigo.findMany({
    select: {
      codigo: true,
      ano: true,
      sequencial: true,
      escola: { select: { sigla: true } },
      classe: { select: { sigla: true } },
    },
  });

  const divergentes = codigos.filter(
    (c) =>
      c.codigo !== montarCodigo(c.escola.sigla, c.ano, c.sequencial, c.classe.sigla),
  );
  if (divergentes.length > 0) {
    problemas.push({
      nivel: "erro",
      mensagem:
        `${divergentes.length} código(s) não batem mais com a sigla atual da escola ` +
        `ou da classe. Exemplo: ${divergentes[0].codigo}. Isso indica que uma sigla ` +
        "foi alterada por fora do sistema.",
    });
  }

  return problemas;
}
