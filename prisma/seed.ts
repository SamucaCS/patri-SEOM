import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CLASSES, ESCOLAS } from "./escolas";

/**
 * Seed com a lista real da URE Suzano.
 *
 * A chave do upsert de escola é o codigoCie, não a sigla. O CIE é o identificador
 * oficial da unidade e não muda; a sigla é invenção nossa e pode ser revisada antes
 * da primeira emissão. Chavear pela sigla faria uma revisão de sigla criar uma
 * unidade nova em vez de atualizar a existente.
 *
 * prisma/escolas.ts é a fonte da verdade e está versionada, então o upsert
 * sobrescreve nome e sigla. Correção de cadastro se faz lá.
 */

async function main() {
  // Seed escreve muito e roda local: conexao direta, nunca o pooler.
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL (ou DATABASE_URL) nao definida.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });


  // Trava: o upsert de classe é chaveado pela SIGLA, então trocar a sigla de uma
  // classe em escolas.ts não renomeia nada - cria uma classe nova e deixa a antiga
  // onde estava. O banco terminaria com quatro classes, a tela ofereceria as quatro,
  // e ninguém veria erro nenhum. Duplicata silenciosa é pior que falha: aqui falha.
  //
  // Só vale quando o banco já tem classe cadastrada; seed em banco vazio cria as três.
  const classesNoBanco = await prisma.classe.findMany({
    select: { sigla: true, nome: true, _count: { select: { codigos: true } } },
  });

  if (classesNoBanco.length > 0 && !process.env.PERMITIR_NOVA_CLASSE) {
    const siglasNoBanco = new Set(classesNoBanco.map((c) => c.sigla));
    const siglasEsperadas = new Set<string>(CLASSES.map((c) => c.sigla));

    const entrando = CLASSES.filter((c) => !siglasNoBanco.has(c.sigla));
    const sumindo = classesNoBanco.filter((c) => !siglasEsperadas.has(c.sigla));

    if (entrando.length > 0 && classesNoBanco.length >= CLASSES.length) {
      const listaEntrando = entrando.map((c) => `${c.sigla} (${c.nome})`).join(", ");
      const listaSumindo =
        sumindo.length > 0
          ? sumindo
              .map(
                (c) =>
                  `${c.sigla} (${c.nome}, ${c._count.codigos} código(s) emitido(s))`,
              )
              .join(", ")
          : "nenhuma";

      console.error(
        [
          "ABORTADO. O seed criaria classe nova sem tirar a antiga do caminho.",
          "",
          `  entraria no banco:        ${listaEntrando}`,
          `  ficaria órfã no banco:    ${listaSumindo}`,
          "",
          `O banco tem ${classesNoBanco.length} classe(s) e escolas.ts define ${CLASSES.length}.`,
          "",
          "Se a intenção era RENOMEAR a sigla de uma classe, não dá: a sigla vai",
          "impressa no código já emitido e é imutável. Reverta em prisma/escolas.ts.",
          "",
          "Se a intenção era ACRESCENTAR uma classe, rode com PERMITIR_NOVA_CLASSE=1.",
        ].join("\n"),
      );
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  for (const classe of CLASSES) {
    await prisma.classe.upsert({
      where: { sigla: classe.sigla },
      update: { nome: classe.nome },
      create: { sigla: classe.sigla, nome: classe.nome },
    });
  }

  // Trava: sigla de unidade que já emitiu é imutável. O código está impresso em
  // campo e carrega aquela sigla para sempre. Sem esta checagem, uma edição
  // distraída em escolas.ts passaria por cima da regra pelo caminho do seed.
  const bloqueadas: string[] = [];
  for (const escola of ESCOLAS) {
    const atual = await prisma.escola.findUnique({
      where: { codigoCie: escola.codigoCie },
      include: { _count: { select: { codigos: true } } },
    });

    if (atual && atual.sigla !== escola.sigla && atual._count.codigos > 0) {
      bloqueadas.push(
        `${atual.nome}: ${atual.sigla} -> ${escola.sigla} ` +
          `(${atual._count.codigos} código(s) já emitido(s))`,
      );
    }
  }

  if (bloqueadas.length > 0) {
    console.error(
      "ABORTADO. O seed tentaria trocar a sigla de unidade que já emitiu código:\n" +
        bloqueadas.map((b) => `  - ${b}`).join("\n") +
        "\n\nSigla é imutável depois da primeira emissão. Reverta a sigla em " +
        "prisma/escolas.ts para o valor atual do banco.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  let renomeadas = 0;
  for (const escola of ESCOLAS) {
    const antes = await prisma.escola.findUnique({
      where: { codigoCie: escola.codigoCie },
      select: { sigla: true },
    });
    if (antes && antes.sigla !== escola.sigla) renomeadas++;

    await prisma.escola.upsert({
      where: { codigoCie: escola.codigoCie },
      update: { nome: escola.nome, sigla: escola.sigla },
      create: {
        sigla: escola.sigla,
        nome: escola.nome,
        codigoCie: escola.codigoCie,
      },
    });
  }

  const escolas = await prisma.escola.count();
  const classes = await prisma.classe.count();

  console.log(`Seed concluido: ${escolas} escolas, ${classes} classes.`);
  if (renomeadas > 0) {
    console.log(`${renomeadas} sigla(s) atualizada(s) - nenhuma tinha código emitido.`);
  }

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
