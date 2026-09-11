"use server";

import { anoCorrente } from "@/lib/config";
import { sequencialAtual } from "@/lib/consultas";
import { EmissaoError, emitirLote } from "@/lib/emissao";

export type ResultadoEmissao =
  | { ok: true; codigos: string[]; loteId: string }
  | { ok: false; codigoErro: string; mensagem: string };

/**
 * Fronteira entre a tela e o dominio.
 *
 * Erros de regra viram mensagem legivel para o operador. Qualquer outra coisa vira
 * mensagem generica e vai para o log do servidor: o operador nao tem o que fazer com
 * um stack trace, e a mensagem crua pode vazar detalhe interno na tela.
 *
 * NAO HA AUTENTICACAO. `emitidoPor` e o que o operador digitou - rastro de auditoria,
 * nao prova de identidade. Qualquer pessoa que alcance esta rota pode emitir com o nome
 * que quiser. Foi decisao do cliente; ver "Sem autenticacao" no README.
 */
export async function emitirLoteAction(input: {
  escolaId: string;
  classeId: string;
  quantidade: number;
  descricao: string;
  emitidoPor: string;
}): Promise<ResultadoEmissao> {
  try {
    const { lote, codigos } = await emitirLote(input);
    return { ok: true, codigos, loteId: lote.id };
  } catch (erro) {
    if (erro instanceof EmissaoError) {
      return { ok: false, codigoErro: erro.codigo, mensagem: erro.message };
    }

    console.error("[emitirLoteAction] Falha inesperada na emissao.", erro);
    return {
      ok: false,
      codigoErro: "ERRO_INESPERADO",
      mensagem:
        "Não foi possível emitir. Nenhum código foi gravado. Tente novamente; " +
        "se persistir, avise o suporte.",
    };
  }
}

/** Sequencial atual do par selecionado, para o indicador da tela. */
export async function sequencialAtualAction(
  escolaId: string,
  classeId: string,
): Promise<number> {
  if (!escolaId || !classeId) return 0;
  return sequencialAtual(escolaId, classeId, anoCorrente());
}
