"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteSupabase } from "@/lib/supabase";

export type ResultadoLogin = { erro: string } | undefined;

/**
 * Entrada por e-mail e senha.
 *
 * Nao existe cadastro aberto, nao existe "esqueci minha senha" e nao existe convite por
 * link. Usuario e criado a mao no painel do Supabase, pela equipe do SEOM. Isso e
 * decisao, nao pendencia: sao poucas pessoas, todas conhecidas, e a alternativa seria
 * uma superficie de auto-cadastro num sistema que emite identificador de patrimonio.
 */
export async function entrarAction(
  _anterior: ResultadoLogin,
  formData: FormData,
): Promise<ResultadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const proximo = String(formData.get("proximo") ?? "/");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    // Mensagem deliberadamente vaga: dizer "este e-mail nao existe" entregaria quais
    // e-mails tem acesso ao sistema.
    console.warn(`[login] Tentativa recusada para ${email}: ${error.message}`);
    return { erro: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  // Só aceita destino interno: `proximo` vem da URL e poderia levar para fora.
  redirect(proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/");
}

export async function sairAction(): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
