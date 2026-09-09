"use client";

import { useState } from "react";
import { SIGLA_CLASSE_MAX_LENGTH, SIGLA_CLASSE_MIN_LENGTH } from "@/lib/config";
import {
  atualizarClasseAction,
  criarClasseAction,
  removerClasseAction,
} from "../actions";

export type ClasseCadastro = {
  id: string;
  sigla: string;
  nome: string;
  ativa: boolean;
  codigos: number;
  siglaTravada: boolean;
};

const entrada =
  "w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-900/20";

export function TabelaClasses({ classes }: { classes: ClasseCadastro[] }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<ClasseCadastro>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState({ sigla: "", nome: "" });

  async function rodar(acao: () => Promise<{ ok: boolean; mensagem?: string }>) {
    if (ocupado) return;
    setOcupado(true);
    setMensagem(null);
    const r = await acao();
    if (!r.ok) setMensagem(r.mensagem ?? "Não foi possível salvar.");
    else setEditando(null);
    setOcupado(false);
    return r.ok;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Classes</h3>
          <p className="text-xs text-slate-500">
            Sigla de {SIGLA_CLASSE_MIN_LENGTH} a {SIGLA_CLASSE_MAX_LENGTH} caracteres ·
            trava na primeira emissão
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {criando ? "Cancelar" : "Nova classe"}
        </button>
      </div>

      {mensagem && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {mensagem}
        </p>
      )}

      {criando && (
        <div className="grid gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 sm:grid-cols-[8rem_1fr_auto]">
          <input
            className={entrada}
            placeholder="Sigla"
            maxLength={SIGLA_CLASSE_MAX_LENGTH}
            value={nova.sigla}
            onChange={(e) => setNova({ ...nova, sigla: e.target.value.toUpperCase() })}
          />
          <input
            className={entrada}
            placeholder="Nome"
            value={nova.nome}
            onChange={(e) => setNova({ ...nova, nome: e.target.value })}
          />
          <button
            type="button"
            disabled={ocupado}
            onClick={async () => {
              const ok = await rodar(() => criarClasseAction(nova));
              if (ok) {
                setNova({ sigla: "", nome: "" });
                setCriando(false);
              }
            }}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:bg-slate-400"
          >
            Adicionar
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Sigla</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Códigos</th>
              <th className="px-4 py-3 font-medium">Ativa</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classes.map((classe) => {
              const emEdicao = editando === classe.id;

              return (
                <tr key={classe.id} className={classe.ativa ? "" : "bg-slate-50"}>
                  <td className="px-4 py-2">
                    {emEdicao && !classe.siglaTravada ? (
                      <input
                        className={`${entrada} codigo w-24`}
                        maxLength={SIGLA_CLASSE_MAX_LENGTH}
                        value={rascunho.sigla ?? classe.sigla}
                        onChange={(e) =>
                          setRascunho({
                            ...rascunho,
                            sigla: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    ) : (
                      <span className="codigo font-semibold text-slate-900">
                        {classe.sigla}
                        {classe.siglaTravada && (
                          <span
                            title={`Travada: ${classe.codigos} código(s) já emitido(s)`}
                            className="ml-1 text-slate-400"
                          >
                            🔒
                          </span>
                        )}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    {emEdicao ? (
                      <input
                        className={entrada}
                        value={rascunho.nome ?? classe.nome}
                        onChange={(e) =>
                          setRascunho({ ...rascunho, nome: e.target.value })
                        }
                      />
                    ) : (
                      <span className="text-slate-700">{classe.nome}</span>
                    )}
                  </td>

                  <td className="px-4 py-2 text-slate-500">{classe.codigos}</td>

                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={classe.ativa}
                      disabled={ocupado}
                      onChange={(e) =>
                        rodar(() =>
                          atualizarClasseAction({
                            id: classe.id,
                            ativa: e.target.checked,
                          }),
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>

                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      {emEdicao ? (
                        <>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() =>
                              rodar(() =>
                                atualizarClasseAction({
                                  id: classe.id,
                                  ...(classe.siglaTravada
                                    ? {}
                                    : { sigla: rascunho.sigla ?? classe.sigla }),
                                  nome: rascunho.nome ?? classe.nome,
                                }),
                              )
                            }
                            className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white disabled:bg-slate-400"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditando(null);
                              setMensagem(null);
                            }}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditando(classe.id);
                              setRascunho({});
                              setMensagem(null);
                            }}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          {classe.codigos === 0 && (
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => {
                                if (confirm(`Excluir a classe ${classe.sigla}?`)) {
                                  rodar(() => removerClasseAction(classe.id));
                                }
                              }}
                              className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              Excluir
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
