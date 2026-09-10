"use server";

import { anoCorrente } from "@/lib/config";
import { sequencialAtual } from "@/lib/consultas";
import { EmissaoError, emitirLote } from "@/lib/emissao";
import { operadorAtual } from "@/lib/sessao";

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
 * A sessao e verificada AQUI, nao so no middleware. Server Action e um endpoint HTTP:
 * da para chama-la direto, sem passar por navegacao. Middleware protege navegacao.
 */
export async function emitirLoteAction(input: {
  escolaId: string;
  classeId: string;
  quantidade: number;
  descricao: string;
}): Promise<ResultadoEmissao> {
  const operador = await operadorAtual();
  if (!operador) {
    return {
      ok: false,
      codigoErro: "SEM_SESSAO",
      mensagem: "Sua sessão expirou. Entre no sistema de novo e repita a emissão.",
    };
  }

  try {
    // `emitidoPor` vem da sessao, NUNCA do cliente. Se viesse do formulario, qualquer
    // pessoa assinaria um lote com o nome de outra - e "Emitido por" e o unico rastro
    // de autoria que este sistema tem.
    const { lote, codigos } = await emitirLote({
      ...input,
      emitidoPor: operador.nome,
    });
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
  const operador = await operadorAtual();
  if (!operador) return 0;

  if (!escolaId || !classeId) return 0;
  return sequencialAtual(escolaId, classeId, anoCorrente());
}
