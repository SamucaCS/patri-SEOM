"use client";

import { useActionState } from "react";
import { entrarAction, type ResultadoLogin } from "./actions";

export function FormularioLogin({ proximo }: { proximo: string }) {
  const [resultado, acao, enviando] = useActionState<ResultadoLogin, FormData>(
    entrarAction,
    undefined,
  );

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="proximo" value={proximo} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="senha" className="block text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {resultado?.erro && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {resultado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
