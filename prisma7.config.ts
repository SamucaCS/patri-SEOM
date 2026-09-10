import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migrations usam a conexao DIRETA (porta 5432), nunca o pooler.
 *
 * O pooler do Supabase em transaction mode nao sustenta DDL em transacao, nem os
 * advisory locks que o proprio `prisma migrate` pega para nao rodar duas vezes ao
 * mesmo tempo. Apontar migration para o pooler falha de formas dificeis de ler.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
