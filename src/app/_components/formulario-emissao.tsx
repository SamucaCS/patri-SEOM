"use client";

import { useCallback, useEffect, useState } from "react";
import { emitirLoteAction, sequencialAtualAction } from "../actions";
import { LOTE_MAX, SEQUENCIAL_DIGITS, montarCodigo } from "@/lib/config";
import { SeletorBusca, type OpcaoBusca } from "./seletor-busca";

type Props = {
  escolas: OpcaoBusca[];
  classes: OpcaoBusca[];
  ano: number;
};

type Erros = Partial<
  Record<"escolaId" | "classeId" | "quantidade" | "descricao" | "emitidoPor", string>
>;

/** Nao ha login: o nome fica lembrado no navegador so para poupar digitacao. */
const CHAVE_OPERADOR = "emissor-seom:emitidoPor";

export function FormularioEmissao({ escolas, classes, ano }: Props) {
  const [escolaId, setEscolaId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [descricao, setDescricao] = useState("");
  const [emitidoPor, setEmitidoPor] = useState("");

  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [sequencial, setSequencial] = useState<number | null>(null);

  // Sem login, o operador digitaria o proprio nome a cada lote. Lembrar poupa isso -
  // e nao e autenticacao nenhuma, so conveniencia.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_OPERADOR);
      if (salvo) setEmitidoPor(salvo);
    } catch {
      /* navegador sem storage: o campo so comeca vazio */
    }
  }, []);

  const escola = escolas.find((e) => e.id === escolaId);
  const classe = classes.find((c) => c.id === classeId);

  // Indicador do sequencial atual do par selecionado.
  useEffect(() => {
    if (!escolaId || !classeId) {
      setSequencial(null);
      return;
    }
    let cancelado = false;
    sequencialAtualAction(escolaId, classeId)
      .then((valor) => {
        if (!cancelado) setSequencial(valor);
      })
      .catch(() => {
        if (!cancelado) setSequencial(null);
      });
    return () => {
      cancelado = true;
    };
  }, [escolaId, classeId]);

  const validar = useCallback((): Erros => {
    const novos: Erros = {};
    if (!escolaId) novos.escolaId = "Selecione a escola.";
    if (!classeId) novos.classeId = "Selecione a classe.";

    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > LOTE_MAX) {
      novos.quantidade = `Informe um número inteiro entre 1 e ${LOTE_MAX}.`;
    }
    if (descricao.trim().length < 3) {
      novos.descricao = "Descreva o lote com pelo menos 3 caracteres.";
    }
    if (emitidoPor.trim().length === 0) {
      novos.emitidoPor = "Informe quem está emitindo.";
    }
    return novos;
  }, [escolaId, classeId, quantidade, descricao, emitidoPor]);

  async function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return; // trava de duplo clique, além do disabled

    const novos = validar();
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    setEnviando(true);
    setErroServidor(null);
    setCodigos(null);
    setCopiado(false);

    try {
      localStorage.setItem(CHAVE_OPERADOR, emitidoPor.trim());
    } catch {
      /* segue sem lembrar */
    }

    const resposta = await emitirLoteAction({
      escolaId,
      classeId,
      quantidade: Number(quantidade),
      descricao,
      emitidoPor,
    });

    if (resposta.ok) {
      setCodigos(resposta.codigos);
      // Limpa o que identifica ESTE lote, para um Enter distraído não repetir a emissão.
      setDescricao("");
      setQuantidade("1");
      setSequencial((atual) => (atual ?? 0) + resposta.codigos.length);
    } else {
      setErroServidor(resposta.mensagem);
    }

    setEnviando(false);
  }

  async function copiarLista() {
    if (!codigos) return;
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErroServidor(
        "O navegador bloqueou a cópia automática. Selecione a lista e copie com Ctrl+C.",
      );
    }
  }

  const proximo = sequencial === null ? null : sequencial + 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <form
        onSubmit={aoEnviar}
        noValidate
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-6"
      >
        <SeletorBusca
          rotulo="Escola"
          opcoes={escolas}
          valorId={escolaId}
          aoSelecionar={setEscolaId}
          erro={erros.escolaId}
          descricao={`${escolas.length} unidades ativas`}
        />

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Classe</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {classes.map((c) => {
              const ativa = c.id === classeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClasseId(c.id)}
                  aria-pressed={ativa}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    ativa
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="codigo font-semibold">{c.sigla}</span>
                  <span className={ativa ? "text-slate-300" : "text-slate-500"}>
                    {" "}
                    · {c.nome}
                  </span>
                </button>
              );
            })}
          </div>
          {erros.classeId && (
            <p className="mt-1 text-xs font-medium text-red-600">{erros.classeId}</p>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="quantidade"
              className="block text-sm font-medium text-slate-700"
            >
              Quantidade
            </label>
            <input
              id="quantidade"
              type="number"
              inputMode="numeric"
              min={1}
              max={LOTE_MAX}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 ${
                erros.quantidade
                  ? "border-red-400 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
            />
            {erros.quantidade ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                {erros.quantidade}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Até {LOTE_MAX} por lote</p>
            )}
          </div>

          <div>
            <label
              htmlFor="emitidoPor"
              className="block text-sm font-medium text-slate-700"
            >
              Emitido por
            </label>
            <input
              id="emitidoPor"
              type="text"
              value={emitidoPor}
              onChange={(e) => setEmitidoPor(e.target.value)}
              placeholder="Seu nome"
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 ${
                erros.emitidoPor
                  ? "border-red-400 bg-red-50"
                  : "border-slate-300 bg-white"
              }`}
            />
            {erros.emitidoPor ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                {erros.emitidoPor}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Registro de auditoria</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="descricao"
            className="block text-sm font-medium text-slate-700"
          >
            Descrição do lote
          </label>
          <input
            id="descricao"
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: 30 cadeiras recebidas em setembro"
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 ${
              erros.descricao ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
            }`}
          />
          {erros.descricao && (
            <p className="mt-1 text-xs font-medium text-red-600">{erros.descricao}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {enviando ? "Emitindo…" : "Emitir códigos"}
        </button>

        {erroServidor && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {erroServidor}
          </div>
        )}
      </form>

      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Próximo código</h2>
          {escola && classe ? (
            <>
              <p className="codigo mt-2 text-lg font-semibold text-slate-900">
                {proximo === null
                  ? "…"
                  : montarCodigo(escola.sigla, ano, proximo, classe.sigla)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {sequencial === null
                  ? "Consultando…"
                  : sequencial === 0
                    ? `Nenhum código de ${classe.sigla} emitido para ${escola.sigla} em ${ano}.`
                    : `Último emitido em ${ano}: ${String(sequencial).padStart(SEQUENCIAL_DIGITS, "0")}.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Selecione escola e classe para ver o sequencial atual.
            </p>
          )}
        </div>

        {codigos && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-emerald-900">
                {codigos.length} código{codigos.length > 1 ? "s" : ""} emitido
                {codigos.length > 1 ? "s" : ""}
              </h2>
              <button
                type="button"
                onClick={copiarLista}
                className="rounded-md border border-emerald-700 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                {copiado ? "Copiado!" : "Copiar lista"}
              </button>
            </div>

            <pre className="codigo mt-3 max-h-80 overflow-auto rounded border border-emerald-200 bg-white p-3 text-sm text-slate-900">
              {codigos.join("\n")}
            </pre>

            <p className="mt-2 text-xs text-emerald-800">
              Estes códigos já estão gravados e não podem ser reemitidos.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
