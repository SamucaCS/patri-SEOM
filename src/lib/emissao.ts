import { Prisma, type Lote, type PrismaClient } from "@/generated/prisma/client";
import {
  ANO_DIGITS,
  DESCRICAO_MAX_LENGTH,
  DESCRICAO_MIN_LENGTH,
  EMITIDO_POR_MAX_LENGTH,
  LOTE_MAX,
  SEQUENCIAL_MAX,
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SIGLA_ESCOLA_LENGTH,
  montarCodigo,
} from "./config";
import { getPrisma } from "./prisma";

export { montarCodigo };

export type EmitirLoteInput = {
  escolaId: string;
  classeId: string;
  quantidade: number;
  descricao: string;
  emitidoPor: string;
};

export type EmitirLoteOpcoes = {
  client?: PrismaClient;
  /**
   * Ano gravado no codigo. Default: ano corrente.
   * Existe para os testes fixarem o ano; a aplicacao nunca passa isso.
   */
  ano?: number;
};

export type EmitirLoteResultado = {
  lote: Lote;
  codigos: string[];
};

export type EmissaoErroCodigo =
  | "QUANTIDADE_INVALIDA"
  | "DESCRICAO_INVALIDA"
  | "EMITIDO_POR_INVALIDO"
  | "ANO_INVALIDO"
  | "ESCOLA_NAO_ENCONTRADA"
  | "CLASSE_NAO_ENCONTRADA"
  | "ESCOLA_INATIVA"
  | "CLASSE_INATIVA"
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

/** Tentativas totais em cima de contencao de escrita. Nunca em cima de unicidade. */
const MAX_TENTATIVAS = 3;
const BACKOFF_BASE_MS = 25;


/**
 * Emite um lote de codigos para um trio (escola, classe, ano).
 *
 * O sequencial reinicia em 1 a cada ano. Isso nao reaproveita codigo: o ano faz parte
 * do codigo, entao SUZ-BR20260001-TEC e SUZ-BR20270001-TEC sao codigos diferentes.
 */
export async function emitirLote(
  input: EmitirLoteInput,
  opcoes: EmitirLoteOpcoes = {},
): Promise<EmitirLoteResultado> {
  const ano = opcoes.ano ?? new Date().getFullYear();

  validarEntrada(input);
  validarAno(ano);

  const db = opcoes.client ?? getPrisma();
  let ultimoErroDeLock: unknown;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      return await emitirLoteUmaVez(input, ano, db);
    } catch (erro) {
      // Violacao de unicidade e bug de logica, nao contencao. Mascarar com retry
      // esconderia o problema: erro explicito e log, sem nova tentativa.
      if (ehViolacaoDeUnicidade(erro)) {
        console.error(
          "[emissao] Constraint de unicidade violada ao emitir lote. Isso e bug de " +
            "logica no calculo do sequencial, nao contencao de escrita. " +
            `escolaId=${input.escolaId} classeId=${input.classeId} ano=${ano} ` +
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

      // Qualquer outro erro que nao seja contencao sobe direto.
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
  ano: number,
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

      // Unidade inativa nao emite. A tela ja filtra o seletor, mas a server action
      // recebe escolaId do cliente: uma aba aberta antes da desativacao, ou um
      // pedido forjado, passariam direto se a regra vivesse so na tela.
      if (!escola.ativa) {
        throw new EmissaoError(
          "ESCOLA_INATIVA",
          `${escola.nome} esta inativa e nao pode emitir codigos.`,
        );
      }
      if (!classe.ativa) {
        throw new EmissaoError(
          "CLASSE_INATIVA",
          `A classe ${classe.nome} esta inativa e nao pode emitir codigos.`,
        );
      }

      validarSiglaEscola(escola.sigla, `escola ${escola.nome}`);
      validarSiglaClasse(classe.sigla, `classe ${classe.nome}`);

      // 1. Ultimo sequencial do trio (escola, classe, ano). Sem filtro por
      //    `cancelado`: codigo cancelado continua ocupando o numero para sempre,
      //    o contador nunca retrocede dentro do ano.
      const agregado = await tx.codigo.aggregate({
        where: { escolaId: input.escolaId, classeId: input.classeId, ano },
        _max: { sequencial: true },
      });
      const ultimo = agregado._max.sequencial ?? 0;

      // 2. Teto por trio (escola, classe, ano).
      if (ultimo + input.quantidade > SEQUENCIAL_MAX) {
        const restante = Math.max(0, SEQUENCIAL_MAX - ultimo);
        throw new EmissaoError(
          "TETO_EXCEDIDO",
          `${escola.sigla}-${classe.sigla} chegou ao sequencial ${ultimo} em ${ano}. ` +
            `Emitir ${input.quantidade} passaria do teto de ${SEQUENCIAL_MAX}. ` +
            `Restam ${restante} codigos para esse par em ${ano}.`,
        );
      }

      // 3. Lote.
      const lote = await tx.lote.create({
        data: {
          escolaId: input.escolaId,
          classeId: input.classeId,
          ano,
          quantidade: input.quantidade,
          descricao: limparTexto(input.descricao),
          emitidoPor: limparTexto(input.emitidoPor),
        },
      });

      // 4. Codigos em memoria.
      const codigos: string[] = [];
      const registros: Prisma.CodigoCreateManyInput[] = [];
      for (let i = 1; i <= input.quantidade; i++) {
        const sequencial = ultimo + i;
        const codigo = montarCodigo(escola.sigla, ano, sequencial, classe.sigla);
        codigos.push(codigo);
        registros.push({
          codigo,
          escolaId: input.escolaId,
          classeId: input.classeId,
          ano,
          sequencial,
          loteId: lote.id,
        });
      }

      // 5. Gravacao. O @@unique([escolaId, classeId, ano, sequencial]) e a rede de
      //    seguranca: se algo escapou, o banco recusa aqui e a transacao some.
      await tx.codigo.createMany({ data: registros });

      return { lote, codigos };
    },
    { maxWait: 5_000, timeout: 20_000 },
  );
}

/**
 * Normaliza texto livre antes de gravar.
 *
 * Tira caractere de controle e colapsa espaco: descricao de lote e uma linha so, e um
 * NUL ou um \r no meio ja apareceu vindo de copiar-e-colar. Alem de sujar a consulta,
 * caractere de controle nao tem representacao valida em XML de planilha.
 */
export function limparTexto(valor: string): string {
  return valor
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  const descricao = limparTexto(input.descricao);
  if (descricao.length < DESCRICAO_MIN_LENGTH) {
    throw new EmissaoError(
      "DESCRICAO_INVALIDA",
      `A descricao do lote e obrigatoria e precisa ter ao menos ` +
        `${DESCRICAO_MIN_LENGTH} caracteres.`,
    );
  }
  // Teto de verdade, nao capricho: texto acima do limite de uma celula derruba a
  // exportacao inteira do .xlsx, e com ela o backup semanal.
  if (descricao.length > DESCRICAO_MAX_LENGTH) {
    throw new EmissaoError(
      "DESCRICAO_INVALIDA",
      `A descricao do lote passa de ${DESCRICAO_MAX_LENGTH} caracteres ` +
        `(tem ${descricao.length}). Resuma: ela aparece na consulta e na exportacao.`,
    );
  }

  const emitidoPor = limparTexto(input.emitidoPor);
  if (emitidoPor.length === 0) {
    throw new EmissaoError(
      "EMITIDO_POR_INVALIDO",
      "Informe quem esta emitindo o lote.",
    );
  }
  if (emitidoPor.length > EMITIDO_POR_MAX_LENGTH) {
    throw new EmissaoError(
      "EMITIDO_POR_INVALIDO",
      `O nome de quem emite passa de ${EMITIDO_POR_MAX_LENGTH} caracteres.`,
    );
  }
}

/** O ano entra no codigo com largura fixa, entao precisa caber em ANO_DIGITS. */
function validarAno(ano: number): void {
  const minimo = 10 ** (ANO_DIGITS - 1);
  const maximo = 10 ** ANO_DIGITS - 1;

  if (!Number.isInteger(ano) || ano < minimo || ano > maximo) {
    throw new EmissaoError(
      "ANO_INVALIDO",
      `O ano ${ano} nao cabe no formato de ${ANO_DIGITS} digitos.`,
    );
  }
}

/**
 * A sigla de escola abre o codigo, entao comprimento misto quebraria o parsing.
 * Largura fixa e obrigatoria, mesmo para escola ja cadastrada fora do padrao.
 */
function validarSiglaEscola(sigla: string, alvo: string): void {
  if (sigla.length !== SIGLA_ESCOLA_LENGTH) {
    throw new EmissaoError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" da ${alvo} tem ${sigla.length} caracteres; o formato exige ` +
        `exatamente ${SIGLA_ESCOLA_LENGTH}.`,
    );
  }
  validarCaracteres(sigla, alvo);
}

/**
 * A sigla de classe fecha o codigo e vem depois de um separador proprio, entao pode
 * ter largura variavel (LB=2, TEC=3, MOBI=4) sem ambiguidade de parsing.
 */
function validarSiglaClasse(sigla: string, alvo: string): void {
  if (
    sigla.length < SIGLA_CLASSE_MIN_LENGTH ||
    sigla.length > SIGLA_CLASSE_MAX_LENGTH
  ) {
    throw new EmissaoError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" da ${alvo} tem ${sigla.length} caracteres; o formato aceita ` +
        `de ${SIGLA_CLASSE_MIN_LENGTH} a ${SIGLA_CLASSE_MAX_LENGTH}.`,
    );
  }
  validarCaracteres(sigla, alvo);
}

function validarCaracteres(sigla: string, alvo: string): void {
  if (!/^[A-Z0-9]+$/.test(sigla)) {
    throw new EmissaoError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" da ${alvo} precisa ser maiuscula, sem acento e sem ` +
        "separador. Minuscula quebraria a unicidade: no SQLite, \"Tec\" e \"TEC\" " +
        "sao valores distintos.",
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
/**
 * Codigo de erro original do SQLite, quando o erro veio pelo driver adapter.
 *
 * O Prisma nao coloca isso na mensagem - fica em
 * `meta.driverAdapterError.cause.originalCode`. E o unico sinal preciso de contencao
 * que chega ate aqui.
 */
function codigoOriginalDoSqlite(erro: unknown): string | undefined {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return undefined;

  const meta = erro.meta as
    | { driverAdapterError?: { cause?: { originalCode?: unknown } } }
    | undefined;

  const codigo = meta?.driverAdapterError?.cause?.originalCode;
  return typeof codigo === "string" ? codigo : undefined;
}

export function ehBancoOcupado(erro: unknown): boolean {
  // Unicidade nunca conta como contencao, mesmo se a mensagem citar lock.
  if (ehViolacaoDeUnicidade(erro)) return false;

  // O sinal e o codigo do SQLite, nao o P1008 do Prisma.
  //
  // Medido: sob contencao real entre conexoes, o Prisma 7 devolve P1008
  // ("Operation has timed out") carregando originalCode SQLITE_BUSY_SNAPSHOT no meta.
  // Esse erro e proprio do modo WAL - a transacao pegou um snapshot de leitura, outra
  // commitou uma escrita depois, e escrever sobre snapshot velho e recusado na hora.
  // O SQLite ignora o busy_timeout nesse caso de proposito: esperar nao resolveria,
  // o snapshot ja esta obsoleto. Por isso falha em ~45ms com busy_timeout 0 ou 5000.
  //
  // Casar com P1008 puro seria largo demais: P1008 e o timeout generico do Prisma.
  // Transacao lenta, por outro lado, da P2028 e corretamente NAO e retentada.
  const original = codigoOriginalDoSqlite(erro);
  if (original && /^SQLITE_(BUSY|LOCKED)/.test(original)) return true;

  // Fallback para quando o erro sobe cru do SQLite, fora do caminho do Prisma.
  return /database is locked|database table is locked|SQLITE_BUSY/i.test(
    mensagensEncadeadas(erro),
  );
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
