// Configuração do formato do código de patrimônio.
//
// SIGLA_ESCOLA_LENGTH ainda precisa ser confirmado contra a lista final das 62
// escolas: havendo qualquer colisão com 2 letras, sobe para 3 e TODAS as siglas são
// regeradas. Isso é irreversível depois da primeira emissão real.

export const SIGLA_ESCOLA_LENGTH = 2;
export const SIGLA_CLASSE_LENGTH = 3;
export const SEQUENCIAL_DIGITS = 5;
export const LOTE_MAX = 200;

/** Teto por par (escola, classe). Com 5 dígitos: 99.999. */
export const SEQUENCIAL_MAX = 10 ** SEQUENCIAL_DIGITS - 1;

/** Comprimento total do código emitido. Sem separadores. */
export const CODIGO_LENGTH =
  SIGLA_ESCOLA_LENGTH + SEQUENCIAL_DIGITS + SIGLA_CLASSE_LENGTH;
