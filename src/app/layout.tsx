import type { Metadata } from "next";
import { Navegacao } from "./_components/navegacao";
import { operadorAtual } from "@/lib/sessao";
import { sairAction } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emissor de Códigos de Patrimônio — SEOM / URE Suzano",
  description:
    "Emissor centralizado de códigos de patrimônio da URE Suzano. Gera códigos únicos e rastreáveis.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // O layout roda no login também, onde não há sessão. Por isso `operadorAtual`, que
  // devolve null, e não `exigirOperador`, que redirecionaria em laço.
  const operador = await operadorAtual();

  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Emissor de Códigos de Patrimônio
              </h1>
              <p className="text-xs text-slate-500">SEOM · URE Suzano</p>
            </div>

            {operador && (
              <div className="flex items-center gap-3">
                <Navegacao />
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {operador.nome}
                </span>
                <form action={sairAction}>
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Sair
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
