import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Seed de desenvolvimento.
 *
 * As tres CLASSES abaixo sao as definidas pelo SEOM e substituem a lista de sete que
 * a especificacao original sugeria. Nao existe mais um balde "Outros": todo bem
 * precisa caber em uma das tres.
 *
 * As ESCOLAS sao placeholders de desenvolvimento, marcadas como EXEMPLO de proposito:
 * a lista definitiva das 62 escolas com sigla e codigo CIE e a pendencia 1 e precisa
 * vir revisada pelo SEOM, com checagem de colisao de siglas.
 *
 * Nao rode este seed contra o banco de producao depois que a lista real entrar.
 */

const CLASSES = [
  { sigla: "LB", nome: "Linha branca (artigos de cozinha)" },
  { sigla: "MOBI", nome: "Mobiliario" },
  { sigla: "TEC", nome: "Tecnologia" },
];

const ESCOLAS_EXEMPLO = [
  { sigla: "AA", codigoCie: "000001", nome: "EXEMPLO - Escola A" },
  { sigla: "AB", codigoCie: "000002", nome: "EXEMPLO - Escola B" },
  { sigla: "AC", codigoCie: "000003", nome: "EXEMPLO - Escola C" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL nao definida.");

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url, timeout: 5000 }),
  });

  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");

  for (const classe of CLASSES) {
    await prisma.classe.upsert({
      where: { sigla: classe.sigla },
      update: { nome: classe.nome },
      create: classe,
    });
  }

  for (const escola of ESCOLAS_EXEMPLO) {
    await prisma.escola.upsert({
      where: { sigla: escola.sigla },
      update: { nome: escola.nome },
      create: escola,
    });
  }

  const classes = await prisma.classe.count();
  const escolas = await prisma.escola.count();
  console.log(`Seed concluido: ${classes} classes, ${escolas} escolas (exemplo).`);

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
