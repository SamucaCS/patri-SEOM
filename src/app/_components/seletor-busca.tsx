"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type OpcaoBusca = { id: string; sigla: string; nome: string };

/** Ignora acento e caixa: quem digita "jose" precisa achar "JOSÉ". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Props = {
  rotulo: string;
  opcoes: OpcaoBusca[];
  valorId: string;
  aoSelecionar: (id: string) => void;
  descricao?: string;
  erro?: string;
};

/**
 * Combobox com busca por nome ou sigla.
 *
 * Sao 64 unidades: um <select> nativo obrigaria a rolar a lista inteira toda vez.
 */
export function SeletorBusca({
  rotulo,
  opcoes,
  valorId,
  aoSelecionar,
  descricao,
  erro,
}: Props) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selecionada = opcoes.find((o) => o.id === valorId);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return opcoes;
    return opcoes.filter(
      (o) =>
        normalizar(o.sigla).includes(termo) || normalizar(o.nome).includes(termo),
    );
  }, [opcoes, busca]);

  // Fecha ao clicar fora, senão a lista fica presa aberta sobre o resto do formulário.
  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!containerRef.current?.contains(evento.target as Node)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  function selecionar(opcao: OpcaoBusca) {
    aoSelecionar(opcao.id);
    setAberto(false);
    setBusca("");
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAberto(true);
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (evento.key === "Enter" && aberto) {
      evento.preventDefault();
      const alvo = filtradas[destaque];
      if (alvo) selecionar(alvo);
    } else if (evento.key === "Escape") {
      setAberto(false);
      setBusca("");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {rotulo}
      </label>

      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        autoComplete="off"
        value={aberto ? busca : selecionada ? `${selecionada.sigla} — ${selecionada.nome}` : ""}
        placeholder="Buscar por nome ou sigla"
        onChange={(e) => {
          setBusca(e.target.value);
          setDestaque(0);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 ${
          erro ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
        }`}
      />

      {descricao && !erro && (
        <p className="mt-1 text-xs text-slate-500">{descricao}</p>
      )}
      {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}

      {aberto && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-300 bg-white shadow-lg"
        >
          {filtradas.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              Nada encontrado para “{busca}”.
            </li>
          )}
          {filtradas.map((opcao, indice) => (
            <li key={opcao.id}>
              <button
                type="button"
                role="option"
                aria-selected={opcao.id === valorId}
                onMouseEnter={() => setDestaque(indice)}
                onClick={() => selecionar(opcao)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm ${
                  indice === destaque ? "bg-slate-100" : "bg-white"
                }`}
              >
                <span className="codigo shrink-0 font-semibold text-slate-900">
                  {opcao.sigla}
                </span>
                <span className="truncate text-slate-600">{opcao.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
