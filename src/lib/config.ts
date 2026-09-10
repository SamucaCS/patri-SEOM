// Configuracao do formato do codigo de patrimonio.
//
//   SUZ-BR20260001-MOBI
//   │   │  │   │    └── sigla da classe (2 a 4 caracteres)
//   │   │  │   └─────── sequencial de 4 digitos, reinicia a cada ano
//   │   │  └─────────── ano de emissao, 4 digitos
//   │   └────────────── sigla da escola (2 caracteres, largura fixa)
//   └────────────────── prefixo fixo da URE
//
// SIGLA_ESCOLA_LENGTH e 2 por decisao do SEOM. Com 2 caracteres a regra automatica
// (iniciais das duas primeiras palavras) colide: 7 colisoes atingindo 16 escolas.
// Por isso 9 siglas sao desempatadas a mao - ver prisma/escolas.ts.
//
// Isso e irreversivel depois da primeira emissao real.

/** Prefixo fixo, igual para todas as unidades. Nao distingue municipio. */
export const PREFIXO_URE = "SUZ";

export const SIGLA_ESCOLA_LENGTH = 2;
export const ANO_DIGITS = 4;
export const SEQUENCIAL_DIGITS = 4;
export const LOTE_MAX = 200;

/**
 * A sigla de classe tem largura variavel (LB=2, TEC=3, MOBI=4).
 *
 * Isso e seguro porque ela e o ULTIMO campo e vem depois de um separador proprio.
 * A sigla de ESCOLA continua tendo que ser de largura fixa: ela vem no meio, entre o
 * prefixo e o ano, e comprimento misto quebraria o parsing por posicao.
 */
export const SIGLA_CLASSE_MIN_LENGTH = 2;
export const SIGLA_CLASSE_MAX_LENGTH = 4;

/** Separador do codigo. Um so, para todos os campos. */
export const SEPARADOR = "-";

/**
 * Tetos de texto livre.
 *
 * Nao sao cosmeticos. Uma celula do .xlsx nao aceita mais de 32.767 caracteres, e o
 * SheetJS lanca ao escrever - derrubando a exportacao INTEIRA, nao so aquela linha.
 * Como o backup semanal depende do .xlsx, um unico lote com texto gigante deixaria a
 * base sem backup e sem explicacao visivel. Cortar na entrada e a defesa barata.
 */
export const DESCRICAO_MIN_LENGTH = 3;
export const DESCRICAO_MAX_LENGTH = 200;
export const EMITIDO_POR_MAX_LENGTH = 100;

/** Teto duro de uma celula de planilha, do proprio formato xlsx. */
export const CELULA_MAX_LENGTH = 32_767;

/** Teto por (escola, classe, ano). Com 4 digitos: 9.999 por ano. */
export const SEQUENCIAL_MAX = 10 ** SEQUENCIAL_DIGITS - 1;

/**
 * Reconhece um codigo completo e bem formado.
 * Nao valida se a escola ou a classe existem - so o formato.
 */
export const CODIGO_REGEX = new RegExp(
  `^${PREFIXO_URE}${SEPARADOR}` +
    `[A-Z0-9]{${SIGLA_ESCOLA_LENGTH}}` +
    `\\d{${ANO_DIGITS}}\\d{${SEQUENCIAL_DIGITS}}` +
    `${SEPARADOR}` +
    `[A-Z0-9]{${SIGLA_CLASSE_MIN_LENGTH},${SIGLA_CLASSE_MAX_LENGTH}}$`,
);

/** Onde o sequencial comeca e termina dentro do codigo, por posicao fixa. */
export const POSICAO_ANO = PREFIXO_URE.length + SEPARADOR.length + SIGLA_ESCOLA_LENGTH;
export const POSICAO_SEQUENCIAL = POSICAO_ANO + ANO_DIGITS;

/**
 * Fuso da URE. O ano do codigo e um fato administrativo de Suzano, nao do relogio da
 * maquina: o mesmo instante precisa dar o mesmo ano rodando aqui, num container em UTC
 * ou num servidor mal configurado.
 */
export const FUSO_URE = "America/Sao_Paulo";

/**
 * Ano corrente em Suzano.
 *
 * NAO usar `new Date().getFullYear()` nem `getUTCFullYear()`:
 *
 *   - `getUTCFullYear()` erra sempre entre 21h e 24h de 31/12: ja virou o ano em UTC,
 *     mas ainda e o ano anterior aqui.
 *   - `getFullYear()` depende do fuso do processo. Acerta nesta maquina e erra na
 *     mesma janela se o servidor estiver em UTC - que e o padrao de container.
 *
 * A janela e de 3 horas por ano, mas cai no fechamento de exercicio, quando ha
 * movimentacao de patrimonio. Um codigo com o ano errado nao tem conserto: quando o
 * erro aparece, a etiqueta ja esta no bem e o numero ja foi digitado no SEOM.
 */
export function anoCorrente(agora: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_URE, year: "numeric" }).format(
      agora,
    ),
  );
}

/**
 * Monta o codigo no formato SUZ-[ESCOLA][ANO][SEQUENCIAL]-[CLASSE].
 *
 *   montarCodigo("BR", 2026, 1, "MOBI") -> "SUZ-BR20260001-MOBI"
 *
 * Vive aqui, e nao em emissao.ts, porque a tela de emissao precisa montar o preview
 * do proximo codigo. emissao.ts puxa o Prisma; este modulo e so constante e string,
 * entao pode ser importado pelo componente cliente sem arrastar o banco para o bundle.
 */
export function montarCodigo(
  siglaEscola: string,
  ano: number,
  sequencial: number,
  siglaClasse: string,
): string {
  const seq = String(sequencial).padStart(SEQUENCIAL_DIGITS, "0");
  return `${PREFIXO_URE}${SEPARADOR}${siglaEscola}${ano}${seq}${SEPARADOR}${siglaClasse}`;
}
