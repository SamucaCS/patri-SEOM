"use client";

import { useMemo, useState } from "react";
import { SIGLA_ESCOLA_LENGTH } from "@/lib/config";
import {
  atualizarEscolaAction,
  criarEscolaAction,
  removerEscolaAction,
} from "../actions";

export type EscolaCadastro = {
  id: string;
  sigla: string;
  codigoCie: string;
  nome: string;
  ativa: boolean;
  codigos: number;
  siglaTravada: boolean;
};

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const entrada =
  "w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-900/20";

export function TabelaEscolas({ escolas }: { escolas: EscolaCadastro[] }) {
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<EscolaCadastro>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState({ sigla: "", codigoCie: "", nome: "" });

  const visiveis = useMemo(() => {
    const termo = normalizar(filtro.trim());
    if (!termo) return escolas;
    return escolas.filter(
      (e) =>
        normalizar(e.sigla).includes(termo) ||
        normalizar(e.nome).includes(termo) ||
        e.codigoCie.toLowerCase().includes(termo),
    );
  }, [escolas, filtro]);

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
          <h3 className="text-base font-semibold text-slate-900">Escolas</h3>
          <p className="text-xs text-slate-500">
            {escolas.length} cadastradas · sigla trava na primeira emissão
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por nome, sigla ou CIE"
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => setCriando((v) => !v)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {criando ? "Cancelar" : "Nova escola"}
          </button>
        </div>
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
        <div className="grid gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 sm:grid-cols-[8rem_10rem_1fr_auto]">
          <input
            className={entrada}
            placeholder={`Sigla (${SIGLA_ESCOLA_LENGTH})`}
            maxLength={SIGLA_ESCOLA_LENGTH}
            value={nova.sigla}
            onChange={(e) =>
              setNova({ ...nova, sigla: e.target.value.toUpperCase() })
            }
          />
          <input
            className={entrada}
            placeholder="CIE"
            value={nova.codigoCie}
            onChange={(e) => setNova({ ...nova, codigoCie: e.target.value })}
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
              const ok = await rodar(() => criarEscolaAction(nova));
              if (ok) {
                setNova({ sigla: "", codigoCie: "", nome: "" });
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
              <th className="px-4 py-3 font-medium">CIE</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Códigos</th>
              <th className="px-4 py-3 font-medium">Ativa</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma escola encontrada.
                </td>
              </tr>
            )}

            {visiveis.map((escola) => {
              const emEdicao = editando === escola.id;

              return (
                <tr key={escola.id} className={escola.ativa ? "" : "bg-slate-50"}>
                  <td className="px-4 py-2">
                    {emEdicao && !escola.siglaTravada ? (
                      <input
                        className={`${entrada} codigo w-20`}
                        maxLength={SIGLA_ESCOLA_LENGTH}
                        value={rascunho.sigla ?? escola.sigla}
                        onChange={(e) =>
                          setRascunho({
                            ...rascunho,
                            sigla: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    ) : (
                      <span className="codigo font-semibold text-slate-900">
                        {escola.sigla}
                        {escola.siglaTravada && (
                          <span
                            title={`Travada: ${escola.codigos} código(s) já emitido(s)`}
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
                        className={`${entrada} w-28`}
                        value={rascunho.codigoCie ?? escola.codigoCie}
                        onChange={(e) =>
                          setRascunho({ ...rascunho, codigoCie: e.target.value })
                        }
                      />
                    ) : (
                      <span
                        className={
                          escola.codigoCie.startsWith("PENDENTE")
                            ? "text-amber-700"
                            : "text-slate-600"
                        }
                      >
                        {escola.codigoCie}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    {emEdicao ? (
                      <input
                        className={entrada}
                        value={rascunho.nome ?? escola.nome}
                        onChange={(e) =>
                          setRascunho({ ...rascunho, nome: e.target.value })
                        }
                      />
                    ) : (
                      <span className="text-slate-700">{escola.nome}</span>
                    )}
                  </td>

                  <td className="px-4 py-2 text-slate-500">{escola.codigos}</td>

                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={escola.ativa}
                      disabled={ocupado}
                      onChange={(e) =>
                        rodar(() =>
                          atualizarEscolaAction({
                            id: escola.id,
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
                                atualizarEscolaAction({
                                  id: escola.id,
                                  ...(escola.siglaTravada
                                    ? {}
                                    : { sigla: rascunho.sigla ?? escola.sigla }),
                                  codigoCie: rascunho.codigoCie ?? escola.codigoCie,
                                  nome: rascunho.nome ?? escola.nome,
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
                              setEditando(escola.id);
                              setRascunho({});
                              setMensagem(null);
                            }}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>
                          {escola.codigos === 0 && (
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Excluir ${escola.sigla} — ${escola.nome}? Ela nunca emitiu código.`,
                                  )
                                ) {
                                  rodar(() => removerEscolaAction(escola.id));
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
