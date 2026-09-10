import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Duas conexoes, de proposito.
 *
 * `DATABASE_URL` e o pooler do Supabase (porta 6543, `?pgbouncer=true`). Na Vercel cada
 * invocacao serverless abriria uma conexao propria e o Postgres estouraria o limite; o
 * pooler existe para absorver isso. Serve para leitura e escrita simples.
 *
 * `DIRECT_URL` e a conexao direta (porta 5432). A transacao interativa de emissao TEM
 * que sair por aqui. Duas razoes, e as duas sao fatais:
 *
 *   1. Transacao interativa por pooler em transaction mode nao se sustenta: o pooler
 *      devolve a conexao ao pool entre statements, entao BEGIN, o SELECT e o INSERT
 *      podem cair em backends diferentes.
 *   2. `pg_advisory_xact_lock` vive na transacao de UMA conexao. Se o statement seguinte
 *      for para outro backend, o lock nao existe para ele - e a serializacao que o lock
 *      deveria dar simplesmente nao acontece, sem erro nenhum.
 *
 * O item 2 e o perigoso: falha calada, e o sintoma e codigo de patrimonio duplicado.
 */

function exigir(nome: "DATABASE_URL" | "DIRECT_URL"): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `${nome} nao definida. Confira as variaveis de ambiente (.env local, ou o painel ` +
        "da Vercel em producao). Ver INSTALL.md.",
    );
  }
  return valor;
}

/**
 * Client apontado para uma URL especifica.
 *
 * `schema` existe para os testes: cada arquivo de teste roda no seu proprio schema do
 * Postgres, para nao disputar as mesmas tabelas com os outros. Em producao fica no
 * default (`public`).
 */
export function criarPrismaClient(url?: string, schema?: string): PrismaClient {
  const adapter = new PrismaPg(
    { connectionString: url ?? exigir("DATABASE_URL") },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}

/**
 * Client da conexao DIRETA, exclusivo da emissao.
 *
 * Nao reaproveita `criarPrismaClient` para que a escolha da URL fique explicita: quem
 * ler esta funcao precisa ver que ela ignora o pooler de proposito.
 */
export function criarPrismaClientDireto(url?: string, schema?: string): PrismaClient {
  const adapter = new PrismaPg(
    { connectionString: url ?? exigir("DIRECT_URL") },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDireto?: PrismaClient;
};

/**
 * Singleton preguicoso do client do pooler.
 *
 * Nao e criado no import: assim importar a logica de emissao nao abre conexao com o
 * banco (os testes dependem disso). Em dev o Next recarrega o modulo a cada edicao, e
 * guardar no globalThis evita abrir uma conexao nova por recarga.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = criarPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Singleton preguicoso do client direto. So a emissao usa. */
export function getPrismaDireto(): PrismaClient {
  if (!globalForPrisma.prismaDireto) {
    globalForPrisma.prismaDireto = criarPrismaClientDireto();
  }
  return globalForPrisma.prismaDireto;
}
