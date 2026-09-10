import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware de sessao.
 *
 * Faz duas coisas:
 *   1. renova o token do Supabase e devolve os cookies atualizados, para a sessao nao
 *      expirar no meio do uso;
 *   2. barra navegacao sem sessao, mandando para /login.
 *
 * NAO e a unica barreira, de proposito. Middleware protege navegacao; nao protege uma
 * Server Action chamada diretamente, nem um Route Handler acessado por URL. Por isso
 * cada rota tambem chama `exigirOperador()`. Duas camadas porque a de cima e facil de
 * contornar e a de baixo e a que decide.
 */

/** Rotas que existem sem sessao. Todo o resto exige login. */
const PUBLICAS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem as variaveis configuradas, nao ha como validar sessao. Falha fechado: manda
  // para o login em vez de deixar passar.
  if (!url || !chave) {
    if (PUBLICAS.some((p) => request.nextUrl.pathname.startsWith(p))) return resposta;
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar) {
        for (const { name, value } of cookiesParaGravar) {
          request.cookies.set(name, value);
        }
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaGravar) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ehPublica = PUBLICAS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !ehPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    // Guarda para onde a pessoa queria ir, e volta para la depois de entrar.
    destino.searchParams.set("proximo", request.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  // Quem ja entrou nao precisa ver o login de novo.
  if (user && request.nextUrl.pathname === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  /**
   * Roda em tudo, menos arquivo estatico e imagem. Inclui as rotas de API e a de
   * exportacao: o `.xlsx` carrega a base inteira, com nome de escola e CIE, e nao pode
   * sair sem sessao.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
