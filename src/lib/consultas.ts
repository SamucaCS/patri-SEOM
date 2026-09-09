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
