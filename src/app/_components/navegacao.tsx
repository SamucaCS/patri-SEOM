"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/", rotulo: "Emissão" },
  { href: "/consulta", rotulo: "Consulta" },
  { href: "/cadastros", rotulo: "Cadastros" },
];

export function Navegacao() {
  const caminho = usePathname();

  return (
    <nav className="flex gap-1" aria-label="Seções">
      {ABAS.map((aba) => {
        const ativa =
          aba.href === "/" ? caminho === "/" : caminho.startsWith(aba.href);

        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={
              ativa
                ? "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            }
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
