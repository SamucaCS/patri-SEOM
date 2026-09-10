import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso no servidor (Server Component, Server Action, Route
 * Handler).
 *
 * O Supabase aqui serve SO para autenticacao. Todo dado de patrimonio continua indo e
 * vindo pelo Prisma - nao ha leitura de tabela por este cliente. Sao duas
 * responsabilidades separadas de proposito: quem entra, e o que se faz depois de
 * entrar.
 *
 * A chave usada e a publica (anon/publishable). Ela nao da privilegio nenhum: quem
 * autoriza e a sessao do usuario, e as tabelas de patrimonio estao fechadas por RLS
 * para qualquer acesso vindo por esta chave.
 */

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `${nome} nao definida. Confira as variaveis de ambiente (.env local, ou o painel ` +
        "da Vercel). Ver INSTALL.md.",
    );
  }
  return valor;
}

export async function criarClienteSupabase() {
  const armazemDeCookies = await cookies();

  return createServerClient(
    exigir("NEXT_PUBLIC_SUPABASE_URL"),
    exigir("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return armazemDeCookies.getAll();
        },
        setAll(cookiesParaGravar) {
          // Em Server Component a gravacao de cookie lanca. Nao e problema: o
          // middleware ja renovou a sessao antes de chegar aqui. Engolir e o padrao
          // recomendado pelo proprio Supabase para este caso.
          try {
            for (const { name, value, options } of cookiesParaGravar) {
              armazemDeCookies.set(name, value, options);
            }
          } catch {
            /* somente-leitura neste contexto */
          }
        },
      },
    },
  );
}
