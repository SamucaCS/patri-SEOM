import { Prisma, type Lote, type PrismaClient } from "@/generated/prisma/client";
import {
  LOTE_MAX,
  SEQUENCIAL_DIGITS,
  SEQUENCIAL_MAX,
  SIGLA_CLASSE_LENGTH,
  SIGLA_ESCOLA_LENGTH,
} from "./config";
import { getPrisma } from "./prisma";

export type EmitirLoteInput = {
  escolaId: string;
  classeId: string;
  quantidade: number;
  descricao: string;
  emitidoPor: string;
};

export type EmitirLoteResultado = {
  lote: Lote;
  codigos: string[];
};

export type EmissaoErroCodigo =
  | "QUANTIDADE_INVALIDA"
  | "DESCRICAO_INVALIDA"
  | "EMITIDO_POR_INVALIDO"
  | "ESCOLA_NAO_ENCONTRADA"
  | "CLASSE_NAO_ENCONTRADA"
  | "SIGLA_INVALIDA"
  | "TETO_EXCEDIDO"
  | "SEQUENCIAL_DUPLICADO"
  | "BANCO_OCUPADO";

export class EmissaoError extends Error {
  readonly codigo: EmissaoErroCodigo;

  constructor(
    codigo: EmissaoErroCodigo,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "EmissaoError";
    this.codigo = codigo;
  }
}

/** Tentativas totais em cima de "database is locked". Nunca em cima de unicidade. */
const MAX_TENTATIVAS = 3;
const BACKOFF_BASE_MS = 25;

/**
 * Monta o codigo no formato [SIGLA_ESCOLA][SEQUENCIAL][SIGLA_CLASSE].
 * Sem separadores, string continua.
 */
export function montarCodigo(
  siglaEscola: string,
  sequencial: number,
  siglaClasse: string,
): string {
  const seq = String(sequencial).padStart(SEQUENCIAL_DIGITS, "0");
  return `${siglaEscola}${seq}${siglaClasse}`;
}

/**
 * Emite um lote de codigos para um par (escola, classe).
 *
 * O `client` opcional existe para os testes apontarem para um arquivo SQLite proprio.
 * Em producao a chamada e `emitirLote(input)` e usa o singleton.
 */
export async function emitirLote(
  input: EmitirLoteInput,
  client?: PrismaClient,
): Promise<EmitirLoteResultado> {
  validarEntrada(input);

  const db = client ?? getPrisma();
  let ultimoErroDeLock: unknown;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      return await emitirLoteUmaVez(input, db);
    } catch (erro) {
      // Violacao de unicidade e bug de logica, nao contencao. Mascarar com retry
      // esconderia o problema: erro explicito e log, sem nova tentativa.
      if (ehViolacaoDeUnicidade(erro)) {
        console.error(
          "[emissao] Constraint de unicidade violada ao emitir lote. Isso e bug de " +
            "logica no calculo do sequencial, nao contencao de escrita. " +
            `escolaId=${input.escolaId} classeId=${input.classeId} ` +
            `quantidade=${input.quantidade}`,
          erro,
        );
        throw new EmissaoError(
          "SEQUENCIAL_DUPLICADO",
          "Sequencial duplicado detectado pelo banco. A emissao foi abortada e nada " +
            "foi gravado. Isso indica falha na logica de emissao - reporte ao suporte.",
          { cause: erro },
        );
      }

      // Qualquer outro erro que nao seja lock sobe direto.
      if (!ehBancoOcupado(erro)) {
        throw erro;
      }

      ultimoErroDeLock = erro;

      if (tentativa < MAX_TENTATIVAS) {
        const espera = BACKOFF_BASE_MS * 2 ** (tentativa - 1) + Math.random() * 25;
        console.warn(
          `[emissao] Banco ocupado (tentativa ${tentativa}/${MAX_TENTATIVAS}). ` +
            `Nova tentativa em ${Math.round(espera)}ms.`,
        );
        await esperar(espera);
      }
    }
  }

  throw new EmissaoError(
    "BANCO_OCUPADO",
    `O banco ficou ocupado nas ${MAX_TENTATIVAS} tentativas. Nenhum codigo foi ` +
      "emitido. Tente novamente em alguns segundos.",
    { cause: ultimoErroDeLock },
  );
}

/**
 * Uma passada da emissao. Leitura do MAX(sequencial) e gravacao dos codigos ficam na
 * MESMA transacao interativa - e isso que impede duas emissoes simultaneas de
 * calcularem o mesmo ponto de partida.
 */
async function emitirLoteUmaVez(
  input: EmitirLoteInput,
  client: PrismaClient,
): Promise<EmitirLoteResultado> {
  return client.$transaction(
    async (tx) => {
      const escola = await tx.escola.findUnique({ where: { id: input.escolaId } });
      if (!escola) {
        throw new EmissaoError(
          "ESCOLA_NAO_ENCONTRADA",
          `Escola ${input.escolaId} nao encontrada.`,
        );
      }

      const classe = await tx.classe.findUnique({ where: { id: input.classeId } });
      if (!classe) {
        throw new EmissaoError(
          "CLASSE_NAO_ENCONTRADA",
          `Classe ${input.classeId} nao encontrada.`,
        );
      }

      validarSigla(escola.sigla, SIGLA_ESCOLA_LENGTH, `escola ${escola.nome}`);
      validarSigla(classe.sigla, SIGLA_CLASSE_LENGTH, `classe ${classe.nome}`);

      // 1. Ultimo sequencial do par. Sem filtro por `cancelado`: codigo cancelado
      //    continua ocupando o numero para sempre, o contador nunca retrocede.
      const agregado = await tx.codigo.aggregate({
        where: { escolaId: input.escolaId, classeId: input.classeId },
        _max: { sequencial: true },
      });
      const ultimo = agregado._max.sequencial ?? 0;

      // 2. Teto de 99.999 por par.
      if (ultimo + input.quantidade > SEQUENCIAL_MAX) {
        const restante = Math.max(0, SEQUENCIAL_MAX - ultimo);
        throw new EmissaoError(
          "TETO_EXCEDIDO",
          `${escola.sigla}/${classe.sigla} chegou ao sequencial ${ultimo}. Emitir ` +
            `${input.quantidade} passaria do teto de ${SEQUENCIAL_MAX}. ` +
            `Restam ${restante} codigos para esse par.`,
        );
      }

      // 3. Lote.
      const lote = await tx.lote.create({
        data: {
          escolaId: input.escolaId,
          classeId: input.classeId,
          quantidade: input.quantidade,
          descricao: input.descricao.trim(),
          emitidoPor: input.emitidoPor.trim(),
        },
      });

      // 4. Codigos em memoria.
      const codigos: string[] = [];
      const registros: Prisma.CodigoCreateManyInput[] = [];
      for (let i = 1; i <= input.quantidade; i++) {
        const sequencial = ultimo + i;
        const codigo = montarCodigo(escola.sigla, sequencial, classe.sigla);
        codigos.push(codigo);
        registros.push({
          codigo,
          escolaId: input.escolaId,
          classeId: input.classeId,
          sequencial,
          loteId: lote.id,
        });
      }

      // 5. Gravacao. O @@unique([escolaId, classeId, sequencial]) e a rede de
      //    seguranca: se algo escapou, o banco recusa aqui e a transacao some.
      await tx.codigo.createMany({ data: registros });

      return { lote, codigos };
    },
    { maxWait: 5_000, timeout: 20_000 },
  );
}

function validarEntrada(input: EmitirLoteInput): void {
  if (!Number.isInteger(input.quantidade)) {
    throw new EmissaoError(
      "QUANTIDADE_INVALIDA",
      "A quantidade precisa ser um numero inteiro.",
    );
  }
  if (input.quantidade < 1 || input.quantidade > LOTE_MAX) {
    throw new EmissaoError(
      "QUANTIDADE_INVALIDA",
      `A quantidade precisa estar entre 1 e ${LOTE_MAX}. Recebido: ${input.quantidade}.`,
    );
  }
  if (input.descricao.trim().length < 3) {
    throw new EmissaoError(
      "DESCRICAO_INVALIDA",
      "A descricao do lote e obrigatoria e precisa ter ao menos 3 caracteres.",
    );
  }
  if (input.emitidoPor.trim().length === 0) {
    throw new EmissaoError(
      "EMITIDO_POR_INVALIDO",
      "Informe quem esta emitindo o lote.",
    );
  }
}

/**
 * Comprimento misto de sigla quebra o parsing do codigo, entao e rejeitado antes de
 * qualquer gravacao - inclusive para escola ja cadastrada com sigla fora do padrao.
 */
function validarSigla(sigla: string, comprimento: number, alvo: string): void {
  if (sigla.length !== comprimento) {
    throw new EmissaoError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" da ${alvo} tem ${sigla.length} caracteres; o formato exige ` +
        `exatamente ${comprimento}.`,
    );
  }
  if (!/^[A-Z0-9]+$/.test(sigla)) {
    throw new EmissaoError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" da ${alvo} precisa ser maiuscula, sem acento e sem separador.`,
    );
  }
}

/** Percorre a cadeia de `cause` para achar a mensagem real vinda do driver. */
function mensagensEncadeadas(erro: unknown): string {
  const partes: string[] = [];
  let atual: unknown = erro;

  for (let profundidade = 0; atual != null && profundidade < 10; profundidade++) {
    if (atual instanceof Error) {
      partes.push(atual.message);
      atual = atual.cause;
    } else if (typeof atual === "string") {
      partes.push(atual);
      break;
    } else {
      break;
    }
  }

  return partes.join(" | ");
}

export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    return true;
  }
  return /unique constraint failed/i.test(mensagensEncadeadas(erro));
}

/**
 * Contencao de escrita: a transacao perdeu a disputa pelo lock e foi desfeita
 * INTEIRA. Retentar e seguro porque nada foi gravado e o MAX(sequencial) e relido do
 * zero na tentativa seguinte.
 *
 * Sobre o P1008: a especificacao previa que contencao chegasse como "database is
 * locked". Nesta stack ela nao chega. Medido contra o SQLite real, o Prisma 7 com
 * driver adapter devolve P1008 ("Operation has timed out") para a transacao perdedora,
 * em ~45ms, com busy_timeout 0, 1 ou 5000 igual - a string "database is locked" nunca
 * aparece. Casar so com a string deixaria o retry como codigo morto.
 *
 * O padrao de texto fica porque e o que aparece quando o erro sobe cru do SQLite,
 * fora do caminho do Prisma.
 */
export function ehBancoOcupado(erro: unknown): boolean {
  // Unicidade nunca conta como contencao, mesmo se a mensagem citar lock.
  if (ehViolacaoDeUnicidade(erro)) return false;

  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P1008") {
    return true;
  }

  return /database is locked|database table is locked|SQLITE_BUSY/i.test(
    mensagensEncadeadas(erro),
  );
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
