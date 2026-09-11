import type { Metadata } from "next";
import { Navegacao } from "./_components/navegacao";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emissor de Códigos de Patrimônio — SEOM / URE Suzano",
  description:
    "Emissor centralizado de códigos de patrimônio da URE Suzano. Gera códigos únicos e rastreáveis.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
            <Navegacao />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
