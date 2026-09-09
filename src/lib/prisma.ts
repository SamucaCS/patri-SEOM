import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * busy_timeout do SQLite, em ms: quanto o driver espera por um lock antes de devolver
 * SQLITE_BUSY.
 *
 * Vale para contencao vinda de FORA do Prisma - outro processo no arquivo, um
 * `prisma studio` aberto, a copia de backup. Medido, ele nao muda o comportamento de
 * duas transacoes concorrentes do proprio Prisma: nesse caso o perdedor volta com
 * P1008 em ~45ms, com busy_timeout 0, 1 ou 5000 igual. Ver o comentario de
 * `ehBancoOcupado` em emissao.ts.
 */
const BUSY_TIMEOUT_MS = 5_000;

/**
 * Cria um PrismaClient apontando para um arquivo SQLite.
 */
export function criarPrismaClient(url?: string): PrismaClient {
  const dbUrl = url ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL nao definida. Confira o .env (esperado: file:./prisma/emissor.db).",
    );
  }

  const adapter = new PrismaBetterSqlite3({ url: dbUrl, timeout: BUSY_TIMEOUT_MS });
  return new PrismaClient({ adapter });
}

/**
 * WAL permite leitura concorrente com escrita e reduz muito a janela de lock.
 * E persistente no arquivo, mas reaplicar na inicializacao e barato e garante que um
 * banco restaurado de backup entre no modo certo.
 */
export async function ativarWal(client: PrismaClient): Promise<void> {
  await client.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await client.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Singleton preguicoso. Nao e criado no import: assim importar a logica de emissao
 * nao abre conexao com o banco de desenvolvimento (os testes dependem disso).
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = criarPrismaClient();
  }
  return globalForPrisma.prisma;
}
