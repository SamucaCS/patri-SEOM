import Link from "next/link";
import {
  buscarCodigos,
  listarClassesAtivas,
  listarEscolasAtivas,
  TAMANHO_PAGINA,
  type FiltrosCodigo,
} from "@/lib/consultas";
import { exigirOperador } from "@/lib/sessao";

export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;

function texto(busca: Busca, chave: string): string {
  const valor = busca[chave];
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function PaginaConsulta({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  // Antes de tudo: a consulta mostra a base inteira, com nome de escola e CIE.
  await exigirOperador();

  const busca = await searchParams;

  const filtros: FiltrosCodigo = {
    escolaId: texto(busca, "escolaId") || undefined,
    classeId: texto(busca, "classeId") || undefined,
    de: texto(busca, "de") || undefined,
    ate: texto(busca, "ate") || undefined,
    codigo: texto(busca, "codigo") || undefined,
  };
  const pagina = Number(texto(busca, "pagina")) || 1;

  const [escolas, classes, resultado] = await Promise.all([
    listarEscolasAtivas(),
    listarClassesAtivas(),
    buscarCodigos(filtros, pagina),
  ]);

  // A exportação carrega os mesmos filtros, sem a paginação.
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) parametros.set(chave, valor);
  }
  const queryFiltros = parametros.toString();
  const temFiltro = queryFiltros.length > 0;

  function href(novaPagina: number) {
    const p = new URLSearchParams(parametros);
    if (novaPagina > 1) p.set("pagina", String(novaPagina));
    const q = p.toString();
    return q ? `/consulta?${q}` : "/consulta";
  }

  const primeiro = (resultado.pagina - 1) * TAMANHO_PAGINA + 1;
  const ultimo = Math.min(resultado.pagina * TAMANHO_PAGINA, resultado.total);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Consulta</h2>
        <p className="mt-1 text-sm text-slate-600">
          Todos os códigos já emitidos. A exportação respeita os filtros aplicados.
        </p>
      </div>

      <form
        method="GET"
        action="/consulta"
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="lg:col-span-2">
          <label htmlFor="escolaId" className="block text-sm font-medium text-slate-700">
            Escola
          </label>
          <select
            id="escolaId"
            name="escolaId"
            defaultValue={filtros.escolaId ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {escolas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.sigla} — {e.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="classeId" className="block text-sm font-medium text-slate-700">
            Classe
          </label>
          <select
            id="classeId"
            name="classeId"
            defaultValue={filtros.classeId ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sigla} — {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="de" className="block text-sm font-medium text-slate-700">
            De
          </label>
          <input
            id="de"
            name="de"
            type="date"
            defaultValue={filtros.de ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="ate" className="block text-sm font-medium text-slate-700">
            Até
          </label>
          <input
            id="ate"
            name="ate"
            type="date"
            defaultValue={filtros.ate ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="codigo" className="block text-sm font-medium text-slate-700">
            Código
          </label>
          <input
            id="codigo"
            name="codigo"
            type="text"
            defaultValue={filtros.codigo ?? ""}
            placeholder="Trecho do código, ex.: SUZ-BR2026"
            className="codigo mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end gap-2 lg:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrar
          </button>
          {temFiltro && (
            <Link
              href="/consulta"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {resultado.total === 0
            ? "Nenhum código encontrado."
            : `${primeiro}–${ultimo} de ${resultado.total} código${resultado.total > 1 ? "s" : ""}`}
          {temFiltro && resultado.total > 0 && " (filtrado)"}
        </p>

        <a
          href={`/consulta/exportar${queryFiltros ? `?${queryFiltros}` : ""}`}
          className={`rounded-md border px-4 py-2 text-sm font-medium ${
            resultado.total === 0
              ? "pointer-events-none border-slate-200 text-slate-400"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
          aria-disabled={resultado.total === 0}
        >
          Exportar .xlsx
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Escola</th>
              <th className="px-4 py-3 font-medium">Classe</th>
              <th className="px-4 py-3 font-medium">Lote</th>
              <th className="px-4 py-3 font-medium">Emitido em</th>
              <th className="px-4 py-3 font-medium">Por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resultado.itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum código para esses filtros.
                </td>
              </tr>
            )}
            {resultado.itens.map((c) => (
              <tr key={c.id} className={c.cancelado ? "bg-red-50/50" : undefined}>
                <td className="codigo whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                  {c.codigo}
                  {c.cancelado && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      cancelado
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  <span className="codigo font-medium">{c.escola.sigla}</span>{" "}
                  <span className="text-slate-500">{c.escola.nome}</span>
                </td>
                <td className="codigo px-4 py-2.5 text-slate-700">{c.classe.sigla}</td>
                <td className="max-w-xs truncate px-4 py-2.5 text-slate-600">
                  {c.lote.descricao}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {FORMATO_DATA.format(c.criadoEm)}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{c.lote.emitidoPor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resultado.paginas > 1 && (
        <div className="flex items-center justify-between">
          <Link
            href={href(resultado.pagina - 1)}
            aria-disabled={resultado.pagina <= 1}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              resultado.pagina <= 1
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Anterior
          </Link>

          <span className="text-sm text-slate-600">
            Página {resultado.pagina} de {resultado.paginas}
          </span>

          <Link
            href={href(resultado.pagina + 1)}
            aria-disabled={resultado.pagina >= resultado.paginas}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              resultado.pagina >= resultado.paginas
                ? "pointer-events-none border-slate-200 text-slate-400"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Próxima
          </Link>
        </div>
      )}
    </div>
  );
}
