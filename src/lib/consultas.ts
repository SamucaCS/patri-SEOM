import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "./prisma";

/**
 * Leituras da tela de emissao.
 *
 * As listas trazem só o que esta ativo: `ativa` nao bloqueia a emissao na camada de
 * dominio (a especificacao nunca disse o que esse campo impede), mas mantem a escola
 * fora do seletor. Se o SEOM quiser bloquear de verdade, a regra sobe para emissao.ts.
 */

export async function listarEscolasAtivas(client?: PrismaClient) {
  const db = client ?? getPrisma();
  return db.escola.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, sigla: true, nome: true, codigoCie: true },
  });
}

export async function listarClassesAtivas(client?: PrismaClient) {
  const db = client ?? getPrisma();
  return db.classe.findMany({
    where: { ativa: true },
    orderBy: { sigla: "asc" },
    select: { id: true, sigla: true, nome: true },
  });
}

export type FiltrosCodigo = {
  escolaId?: string;
  classeId?: string;
  /** Inicio do periodo, inclusivo. */
  de?: string;
  /** Fim do periodo, inclusivo: o dia inteiro entra. */
  ate?: string;
  /** Trecho do codigo. */
  codigo?: string;
};

export const TAMANHO_PAGINA = 50;

/**
 * Traduz os filtros da tela para um `where` do Prisma.
 *
 * A mesma funcao serve a tabela e a exportacao, de proposito: se fossem dois `where`
 * escritos a mao, o .xlsx acabaria divergindo do que a tela mostra.
 */
function montarWhere(filtros: FiltrosCodigo) {
  const where: Record<string, unknown> = {};

  if (filtros.escolaId) where.escolaId = filtros.escolaId;
  if (filtros.classeId) where.classeId = filtros.classeId;

  if (filtros.codigo?.trim()) {
    // Codigo e sempre maiusculo; o SQLite compara texto sensivel a caixa.
    where.codigo = { contains: filtros.codigo.trim().toUpperCase() };
  }

  const de = filtros.de ? new Date(`${filtros.de}T00:00:00`) : null;
  const ate = filtros.ate ? new Date(`${filtros.ate}T23:59:59.999`) : null;
  if ((de && !Number.isNaN(de.valueOf())) || (ate && !Number.isNaN(ate.valueOf()))) {
    where.criadoEm = {
      ...(de && !Number.isNaN(de.valueOf()) ? { gte: de } : {}),
      ...(ate && !Number.isNaN(ate.valueOf()) ? { lte: ate } : {}),
    };
  }

  return where;
}

const INCLUDE_COMPLETO = {
  escola: { select: { sigla: true, nome: true, codigoCie: true } },
  classe: { select: { sigla: true, nome: true } },
  lote: { select: { descricao: true, emitidoPor: true } },
} as const;

/** Uma pagina de codigos, do mais recente para o mais antigo. */
export async function buscarCodigos(
  filtros: FiltrosCodigo,
  pagina: number,
  client?: PrismaClient,
) {
  const db = client ?? getPrisma();
  const where = montarWhere(filtros);
  const paginaSegura = Math.max(1, Math.floor(pagina) || 1);

  const [total, itens] = await Promise.all([
    db.codigo.count({ where }),
    db.codigo.findMany({
      where,
      include: INCLUDE_COMPLETO,
      orderBy: [{ criadoEm: "desc" }, { sequencial: "desc" }],
      skip: (paginaSegura - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
    }),
  ]);

  return {
    itens,
    total,
    pagina: paginaSegura,
    paginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)),
  };
}

/** Todos os codigos que batem com os filtros, sem paginar. Usado pela exportacao. */
export async function buscarCodigosParaExportar(
  filtros: FiltrosCodigo,
  client?: PrismaClient,
) {
  const db = client ?? getPrisma();
  return db.codigo.findMany({
    where: montarWhere(filtros),
    include: INCLUDE_COMPLETO,
    orderBy: [{ criadoEm: "desc" }, { sequencial: "desc" }],
  });
}

export type CodigoDetalhado = Awaited<
  ReturnType<typeof buscarCodigosParaExportar>
>[number];

/**
 * Ultimo sequencial usado pelo trio (escola, classe, ano).
 * Zero quer dizer que o proximo codigo do par comeca em 1.
 */
export async function sequencialAtual(
  escolaId: string,
  classeId: string,
  ano: number,
  client?: PrismaClient,
): Promise<number> {
  const db = client ?? getPrisma();
  const agregado = await db.codigo.aggregate({
    where: { escolaId, classeId, ano },
    _max: { sequencial: true },
  });
  return agregado._max.sequencial ?? 0;
}
