import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarPrismaClientDireto } from "@/lib/prisma";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma", "migrations");

/**
 * Banco de teste: um SCHEMA proprio num Postgres de verdade, com as migrations reais.
 *
 * Nada aqui usa mock do Prisma, de proposito. Um teste de concorrencia contra mock
 * passa sempre e nao prova nada: o que esta sendo testado e a serializacao do
 * `pg_advisory_xact_lock`, que so existe no banco real. Com SQLite isso era um arquivo
 * temporario; aqui e um schema temporario, e a razao e a mesma.
 *
 * Sempre pela conexao DIRETA. Duas razoes:
 *   - o pooler em transaction mode nao sustenta transacao interativa, que e justamente
 *     o que a emissao faz e o que precisa ser testado;
 *   - `SET search_path`, `CREATE SCHEMA` e `DROP SCHEMA` dependem da sessao, e o pooler
 *     nao garante a mesma sessao entre statements.
 */
export type BancoDeTeste = {
  /** Client principal, equivalente ao singleton da aplicacao. */
  prisma: PrismaClient;
  /** Nome do schema criado para este teste. */
  schema: string;
  /** Abre uma conexao adicional ao MESMO schema (concorrencia entre conexoes). */
  novaConexao: () => PrismaClient;
  destruir: () => Promise<void>;
};

function urlDeTeste(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DIRECT_URL nao definida. Os testes rodam contra um Postgres real - nao ha " +
        "banco em memoria aqui de proposito. Configure o .env antes de rodar.",
    );
  }
  if (/:6543|pgbouncer=true/.test(url)) {
    throw new Error(
      "DIRECT_URL aponta para o POOLER (porta 6543). Os testes precisam da conexao " +
        "direta (5432): transacao interativa e advisory lock nao sobrevivem ao pooler, " +
        "e o teste de concorrencia passaria sem estar testando nada.",
    );
  }
  return url;
}

/**
 * Migrations que NAO entram no schema de teste.
 *
 * A de RLS mexe em `public` e em privilegios de papel (`REVOKE ... IN SCHEMA public`,
 * `ALTER DEFAULT PRIVILEGES`), que sao globais e nao seguem o `search_path`. Rodar isso
 * a cada arquivo de teste mexeria no schema de producao do mesmo banco - efeito
 * colateral inaceitavel num teste.
 *
 * RLS e verificado separadamente, contra o banco real, por `npm run rls:conferir`. Isso
 * nao e furo de cobertura: RLS protege a API REST do Supabase, que nao existe no schema
 * de teste, e nao restringe o Prisma (dono da tabela bypassa RLS).
 */
const MIGRATIONS_FORA_DO_TESTE = [/_rls$/];

function sqlDasMigrations(): string {
  const todas = readdirSync(MIGRATIONS_DIR).filter((nome) =>
    existsSync(path.join(MIGRATIONS_DIR, nome, "migration.sql")),
  );

  const pastas = todas
    .filter((nome) => !MIGRATIONS_FORA_DO_TESTE.some((re) => re.test(nome)))
    .sort();

  if (pastas.length === 0) {
    throw new Error(
      `Nenhuma migration encontrada em ${MIGRATIONS_DIR}. Rode: npx prisma migrate dev`,
    );
  }

  return pastas
    .map((pasta) => readFileSync(path.join(MIGRATIONS_DIR, pasta, "migration.sql"), "utf8"))
    .join("\n");
}

/**
 * Cria o schema e aplica as migrations dentro dele.
 *
 * As migrations do Prisma usam nome de tabela sem qualificar, entao aplicar com o
 * `search_path` apontado para o schema novo cria tudo no lugar certo.
 */
async function prepararSchema(url: string, schema: string): Promise<void> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query(`CREATE SCHEMA "${schema}"`);
    await cliente.query(`SET search_path TO "${schema}"`);
    await cliente.query(sqlDasMigrations());
  } finally {
    await cliente.end();
  }
}

async function removerSchema(url: string, schema: string): Promise<void> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await cliente.end();
  }
}

export async function criarBancoDeTeste(): Promise<BancoDeTeste> {
  const url = urlDeTeste();
  // Nome curto: o Postgres corta identificador em 63 bytes.
  const schema = `teste_${randomBytes(6).toString("hex")}`;

  await prepararSchema(url, schema);

  const conexoes: PrismaClient[] = [];

  const novaConexao = () => {
    const client = criarPrismaClientDireto(url, schema);
    conexoes.push(client);
    return client;
  };

  const prisma = novaConexao();

  return {
    prisma,
    schema,
    novaConexao,
    destruir: async () => {
      for (const client of conexoes) {
        await client.$disconnect().catch(() => undefined);
      }
      await removerSchema(url, schema).catch(() => undefined);
    },
  };
}

/** Cria uma escola de teste. Sigla precisa respeitar SIGLA_ESCOLA_LENGTH. */
export async function criarEscola(
  prisma: PrismaClient,
  sigla: string,
  nome = `Escola ${sigla}`,
) {
  return prisma.escola.create({
    data: {
      sigla,
      nome,
      codigoCie: `CIE-${sigla}-${randomBytes(4).toString("hex")}`,
    },
  });
}

/** Cria uma classe de teste. Sigla de 2 a 4 caracteres (LB, TEC, MOBI). */
export async function criarClasse(
  prisma: PrismaClient,
  sigla: string,
  nome = `Classe ${sigla}`,
) {
  return prisma.classe.create({ data: { sigla, nome } });
}
