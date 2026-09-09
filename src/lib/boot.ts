import type { PrismaClient } from "@/generated/prisma/client";
import {
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SIGLA_ESCOLA_LENGTH,
} from "./config";
import { montarCodigo } from "./emissao";
import { getPrisma } from "./prisma";

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
): Promise<Problema[]> {
  const db = client ?? getPrisma();
  const problemas: Problema[] = [];

  // 1. WAL. Sem ele, leitura e escrita concorrentes brigam bem mais.
  try {
    const modo = await db.$queryRawUnsafe<Array<{ journal_mode: string }>>(
      "PRAGMA journal_mode;",
    );
    const atual = modo[0]?.journal_mode?.toLowerCase();
    if (atual && atual !== "wal") {
      problemas.push({
        nivel: "aviso",
        mensagem: `O banco está em journal_mode "${atual}", não em WAL.`,
      });
    }
  } catch {
    problemas.push({
      nivel: "aviso",
      mensagem: "Não foi possível confirmar o journal_mode do banco.",
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
