import type { NextRequest } from "next/server";
import { buscarCodigosParaExportar, type FiltrosCodigo } from "@/lib/consultas";
import { montarPlanilha, nomeArquivoExportacao } from "@/lib/exportacao";
import { operadorAtual } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/**
 * Exporta o resultado da consulta em .xlsx.
 *
 * Le os MESMOS parametros de busca da tela, entao o arquivo baixado corresponde
 * exatamente ao que estava filtrado - nunca a base inteira por engano.
 *
 * Route Handler e URL: da para chamar direto, sem passar pela tela. Por isso a sessao
 * e verificada aqui tambem, e nao so no middleware. Sem filtro, esta rota devolve a
 * base completa - nome, CIE e codigo das 64 unidades - num unico arquivo.
 */
export async function GET(request: NextRequest) {
  const operador = await operadorAtual();
  if (!operador) {
    return new Response("Faça login para exportar.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

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
