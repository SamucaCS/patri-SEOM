import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { CLASSES, ESCOLAS } from "./escolas";

/**
 * Seed com a lista real da URE Suzano.
 *
 * Idempotente: roda por upsert com a sigla como chave, entao rodar de novo nao
 * duplica nada e nao mexe em codigo ja emitido.
 *
 * O codigo CIE entra como placeholder "PENDENTE-<sigla>" porque o campo e
 * obrigatorio e unico no schema e a lista de origem nao trouxe os CIEs. O upsert NAO
 * sobrescreve o CIE de quem ja tem um: assim, depois que o SEOM preencher os CIEs
 * reais pela tela de Cadastros, rodar o seed de novo nao apaga o trabalho.
 */

function cieProvisorio(sigla: string): string {
  return `PENDENTE-${sigla}`;
}

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
      create: { sigla: classe.sigla, nome: classe.nome },
    });
  }

  for (const escola of ESCOLAS) {
    await prisma.escola.upsert({
      where: { sigla: escola.sigla },
      // Só o nome é atualizado: o CIE preenchido a mão pelo SEOM fica preservado.
      update: { nome: escola.nome },
      create: {
        sigla: escola.sigla,
        nome: escola.nome,
        codigoCie: cieProvisorio(escola.sigla),
      },
    });
  }

  const escolas = await prisma.escola.count();
  const classes = await prisma.classe.count();
  const semCie = await prisma.escola.count({
    where: { codigoCie: { startsWith: "PENDENTE-" } },
  });

  console.log(`Seed concluido: ${escolas} escolas, ${classes} classes.`);
  if (semCie > 0) {
    console.log(
      `ATENCAO: ${semCie} escola(s) ainda com codigo CIE provisorio. ` +
        "Preencher antes da primeira emissao real.",
    );
  }

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
