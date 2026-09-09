import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Seed de desenvolvimento.
 *
 * As CLASSES abaixo sao a sugestao da especificacao e ainda precisam do aceite do
 * SEOM (pendencia 2). As ESCOLAS sao placeholders de desenvolvimento, marcadas como
 * EXEMPLO de proposito: a lista definitiva das 62 escolas com sigla e codigo CIE e a
 * pendencia 1 e precisa vir revisada pelo SEOM, com checagem de colisao de siglas.
 *
 * Nao rode este seed contra o banco de producao depois que a lista real entrar.
 */

const CLASSES = [
  { sigla: "TEC", nome: "Tecnologia e informatica" },
  { sigla: "MOV", nome: "Moveis" },
  { sigla: "ELE", nome: "Eletroeletronicos" },
  { sigla: "COZ", nome: "Cozinha e refeitorio" },
  { sigla: "LAB", nome: "Laboratorio e material didatico" },
  { sigla: "ESP", nome: "Esportivo" },
  { sigla: "OUT", nome: "Outros" },
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
