import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { PrismaClient } from "@/generated/prisma/client";
import { criarPrismaClient } from "@/lib/prisma";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma", "migrations");

/**
 * Banco de teste: um arquivo SQLite de verdade, com as migrations reais aplicadas.
 *
 * Nada aqui usa mock do Prisma de proposito. Um teste de concorrencia contra mock
 * passa sempre e nao prova nada: o que esta sendo testado e o comportamento do
 * SQLite sob escrita concorrente, que so existe no banco real.
 */
export type BancoDeTeste = {
  /** Client principal, equivalente ao singleton da aplicacao. */
  prisma: PrismaClient;
  caminho: string;
  /** Abre uma conexao adicional ao MESMO arquivo (concorrencia entre conexoes). */
  novaConexao: () => PrismaClient;
  destruir: () => Promise<void>;
};

function aplicarMigrations(caminho: string): void {
  const db = new Database(caminho);
  db.pragma("journal_mode = WAL");

  const pastas = readdirSync(MIGRATIONS_DIR)
    .filter((nome) => existsSync(path.join(MIGRATIONS_DIR, nome, "migration.sql")))
    .sort();

  if (pastas.length === 0) {
    db.close();
    throw new Error(
      `Nenhuma migration encontrada em ${MIGRATIONS_DIR}. Rode: npx prisma migrate dev`,
    );
  }

  for (const pasta of pastas) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, pasta, "migration.sql"), "utf8");
    db.exec(sql);
  }

  db.close();
}

export function criarBancoDeTeste(): BancoDeTeste {
  const dir = mkdtempSync(path.join(tmpdir(), "emissor-teste-"));
  const caminho = path.join(dir, "emissor.db");

  aplicarMigrations(caminho);

  const conexoes: PrismaClient[] = [];

  const novaConexao = () => {
    const client = criarPrismaClient(caminho);
    conexoes.push(client);
    return client;
  };

  const prisma = novaConexao();

  return {
    prisma,
    caminho,
    novaConexao,
    destruir: async () => {
      for (const client of conexoes) {
        await client.$disconnect().catch(() => undefined);
      }
      // No Windows o arquivo pode ficar preso por um instante depois do disconnect.
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* diretorio temporario, o SO limpa depois */
      }
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
    data: { sigla, nome, codigoCie: `CIE-${sigla}-${Math.random().toString(36).slice(2, 8)}` },
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
