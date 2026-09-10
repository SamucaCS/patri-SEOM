import { Prisma, type Lote, type PrismaClient } from "@/generated/prisma/client";
import {
  ANO_DIGITS,
  anoCorrente,
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
import { getPrismaDireto } from "./prisma";

export { montarCodigo };

export type EmitirLoteInput = {
  escolaId: string;
  classeId: string;
  quantidade: number;
  descricao: string;
  /**
   * Quem esta emitindo. Vem da SESSAO, preenchido pela server action - nao e mais
   * campo digitado na tela. Continua parametro aqui para os testes controlarem.
   */
  emitidoPor: string;
};

export type EmitirLoteOpcoes = {
  client?: PrismaClient;
  /**
   * Ano gravado no codigo. Default: ano corrente em Suzano (`anoCorrente()`).
   *
   * Existe SO para os testes fixarem o ano. A server action nunca passa isso, e nao
   * deve passar a aceitar: ano vindo do cliente deixaria o operador escolher em que
   * exercicio o codigo cai, e o sequencial de um ano fechado voltaria a andar.
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
  | "SEQUENCIAL_DUPLICADO";

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

/**
 * Emite um lote de codigos para um trio (escola, classe, ano).
 *
 * O sequencial reinicia em 1 a cada ano. Isso nao reaproveita codigo: o ano faz parte
 * do codigo, entao SUZ-BR20260001-TEC e SUZ-BR20270001-TEC sao codigos diferentes.
 *
 * Roda na conexao DIRETA, nunca no pooler - ver `getPrismaDireto` e o comentario do
 * advisory lock em `emitirLoteUmaVez`.
 *
 * Nao ha retry, e nao deveria haver. No SQLite, contencao voltava como erro
 * (SQLITE_BUSY_SNAPSHOT) e precisava de nova tentativa. No Postgres o advisory lock
 * ESPERA: quem chega depois fica bloqueado ate o primeiro commitar, e ai le o MAX() ja
 * atualizado. Nao ha o que retentar.
 */
export async function emitirLote(
  input: EmitirLoteInput,
  opcoes: EmitirLoteOpcoes = {},
): Promise<EmitirLoteResultado> {
  const ano = opcoes.ano ?? anoCorrente();

  validarEntrada(input);
  validarAno(ano);

  const db = opcoes.client ?? getPrismaDireto();

  try {
    return await emitirLoteUmaVez(input, ano, db);
  } catch (erro) {
    // Violacao de unicidade continua PROIBIDA de virar retry. Com o advisory lock em
    // vigor, duas emissoes do mesmo trio nao podem ler o mesmo MAX(): se a constraint
    // disparou, a serializacao falhou - chave do lock errada, lock tomado depois do
    // SELECT, ou a transacao saiu pelo pooler em vez da conexao direta. Retentar
    // esconderia exatamente o defeito que precisa aparecer.
    if (ehViolacaoDeUnicidade(erro)) {
      console.error(
        "[emissao] Constraint de unicidade violada ao emitir lote. Com o advisory " +
          "lock ativo isso NAO deveria acontecer. Suspeitar, nesta ordem: transacao " +
          "saindo pelo pooler (precisa ser DIRECT_URL); lock tomado depois do MAX(); " +
          "chave do lock diferente da esperada. " +
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

    throw erro;
  }
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
      // 0. SERIALIZACAO DO TRIO. Precisa vir ANTES do MAX(), senao nao serve de nada.
      //
      //    No SQLite isso era de graca: o banco serializa escrita por natureza, e duas
      //    transacoes nunca liam o mesmo MAX(). O Postgres nao faz isso. Em READ
      //    COMMITTED - o isolamento padrao - duas transacoes leem o mesmo MAX(), montam
      //    o mesmo sequencial, e a segunda so descobre no INSERT, quando a constraint
      //    dispara e a emissao inteira e perdida.
      //
      //    `pg_advisory_xact_lock` bloqueia em vez de falhar, e e liberado no COMMIT ou
      //    ROLLBACK sem unlock explicito: transacao que morre no meio nao deixa lock
      //    preso.
      //
      //    A chave (escolaId, classeId, ano) passa por `hashtext`, que devolve int4.
      //    Duas chaves diferentes podem colidir nesse espaco; o efeito e apenas dois
      //    trios distintos se serializando entre si - seguro, no maximo um pouco mais
      //    lento. O contrario, dois trios IGUAIS pegando locks diferentes, e
      //    impossivel: mesma string, mesmo hash. E e so isso que a corretude exige.
      const chaveDoLock = `${input.escolaId}:${input.classeId}:${ano}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${chaveDoLock})::bigint)`;

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
      "Nao foi possivel identificar quem esta emitindo. Entre no sistema de novo.",
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
        'separador. Minuscula quebraria a unicidade: "Tec" e "TEC" sao valores ' +
        "distintos para a constraint.",
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

/**
 * Violacao de unicidade. NUNCA vira retry - ver o comentario em `emitirLote`.
 *
 * Casa por tres caminhos porque o erro pode chegar em formatos diferentes: o Prisma
 * classificado (P2002), o SQLSTATE cru do Postgres (23505) quando sobe pelo driver, e
 * a mensagem em texto. Antes havia tambem deteccao de contencao (`ehBancoOcupado`,
 * SQLITE_BUSY_SNAPSHOT); ela saiu junto com o SQLite, porque no Postgres a contencao
 * do trio e resolvida esperando no advisory lock, nao falhando.
 */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    return true;
  }

  const mensagem = mensagensEncadeadas(erro);
  if (/\b23505\b|duplicate key value violates unique constraint/i.test(mensagem)) {
    return true;
  }
  return /unique constraint failed/i.test(mensagem);
}
