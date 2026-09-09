import type { NextRequest } from "next/server";
import { buscarCodigosParaExportar, type FiltrosCodigo } from "@/lib/consultas";
import { montarPlanilha, nomeArquivoExportacao } from "@/lib/exportacao";

export const dynamic = "force-dynamic";

/**
 * Exporta o resultado da consulta em .xlsx.
 *
 * Le os MESMOS parametros de busca da tela, entao o arquivo baixado corresponde
 * exatamente ao que estava filtrado - nunca a base inteira por engano.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const filtros: FiltrosCodigo = {
    escolaId: p.get("escolaId") ?? undefined,
    classeId: p.get("classeId") ?? undefined,
    de: p.get("de") ?? undefined,
    ate: p.get("ate") ?? undefined,
    codigo: p.get("codigo") ?? undefined,
  };

  try {
    const codigos = await buscarCodigosParaExportar(filtros);
    const planilha = montarPlanilha(codigos);

    return new Response(new Uint8Array(planilha), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivoExportacao()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[exportar] Falha ao gerar a planilha.", erro);
    return new Response("Não foi possível gerar a planilha. Verifique o log do servidor.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
