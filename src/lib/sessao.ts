import { redirect } from "next/navigation";
import { criarClienteSupabase } from "./supabase";
import { EMITIDO_POR_MAX_LENGTH } from "./config";

export type Operador = {
  id: string;
  email: string;
  /** O que vai para o campo "Emitido por" do lote. */
  nome: string;
};

/**
 * Quem esta operando, ou `null`.
 *
 * Usa `getUser()`, nao `getSession()`. `getSession()` le o cookie e confia nele;
 * `getUser()` valida o token contra o Supabase. Num sistema onde a unica barreira e a
 * sessao, confiar em cookie nao verificado seria a barreira inteira.
 */
export async function operadorAtual(): Promise<Operador | null> {
  const supabase = await criarClienteSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  // Nome vem do metadata se o painel preencheu; senao, o e-mail. Nunca vazio, porque
  // "Emitido por" e o unico rastro de autoria que existe.
  const doMetadata =
    typeof user.user_metadata?.nome === "string" ? user.user_metadata.nome.trim() : "";
  const nome = (doMetadata || user.email).slice(0, EMITIDO_POR_MAX_LENGTH);

  return { id: user.id, email: user.email, nome };
}

/**
 * Igual, mas manda para o login se nao houver sessao.
 *
 * Toda rota que mostra ou grava dado de patrimonio comeca por aqui. O middleware ja
 * barra antes, mas esta checagem e a que vale: middleware protege navegacao, nao
 * protege uma Server Action chamada direto.
 */
export async function exigirOperador(): Promise<Operador> {
  const operador = await operadorAtual();
  if (!operador) redirect("/login");
  return operador;
}
