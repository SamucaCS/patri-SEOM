// Configuracao do formato do codigo de patrimonio.
//
//   BRA-202600001-MOBI
//   │  │   │     └── sigla da classe (2 a 4 caracteres)
//   │  │   └──────── sequencial de 5 digitos, reinicia a cada ano
//   │  └──────────── ano de emissao, 4 digitos
//   └─────────────── sigla da escola (largura fixa)
//
// SIGLA_ESCOLA_LENGTH e 3, e nao 2, por medicao e nao por gosto. A checagem de
// colisao contra a lista real (64 entradas: a URE + 63 escolas) deu:
//
//   2 caracteres -> 7 colisoes atingindo 16 escolas   (inviavel)
//   3 caracteres -> 0 colisoes, resolvendo 4 a mao    (adotado)
//
// Ver prisma/escolas.ts. Isso e irreversivel depois da primeira emissao real.

export const SIGLA_ESCOLA_LENGTH = 3;
export const SEQUENCIAL_DIGITS = 5;
export const ANO_DIGITS = 4;
export const LOTE_MAX = 200;

/**
 * A sigla de classe tem largura variavel (LB=2, TEC=3, MOBI=4).
 *
 * Isso e seguro porque ela e o ULTIMO campo e vem depois de um separador proprio.
 * A sigla de ESCOLA continua tendo que ser de largura fixa: ela abre o codigo, e ali
 * comprimento misto quebraria o parsing de verdade.
 */
export const SIGLA_CLASSE_MIN_LENGTH = 2;
export const SIGLA_CLASSE_MAX_LENGTH = 4;

/** Separadores do codigo. */
export const SEPARADOR_ESCOLA = "-";
export const SEPARADOR_CLASSE = "-";

/** Teto por (escola, classe, ano). Com 5 digitos: 99.999 por ano. */
export const SEQUENCIAL_MAX = 10 ** SEQUENCIAL_DIGITS - 1;

/**
 * Reconhece um codigo completo e bem formado.
 * Nao valida se a escola ou a classe existem - so o formato.
 */
export const CODIGO_REGEX = new RegExp(
  `^[A-Z0-9]{${SIGLA_ESCOLA_LENGTH}}` +
    `${SEPARADOR_ESCOLA}` +
    `\\d{${ANO_DIGITS}}\\d{${SEQUENCIAL_DIGITS}}` +
    `${SEPARADOR_CLASSE}` +
    `[A-Z0-9]{${SIGLA_CLASSE_MIN_LENGTH},${SIGLA_CLASSE_MAX_LENGTH}}$`,
);
