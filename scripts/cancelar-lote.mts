import "dotenv/config";
import { appendFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { FUSO_URE } from "../src/lib/config";
import { criarPrismaClientDireto } from "../src/lib/prisma";

/**
 * Cancelamento de lote pela linha de comando.
 *
 *   npm run cancelar -- <id-do-lote> --por "Nome de quem cancela"
 *
 * Não existe tela para isso, e não deveria mesmo: cancelar é raro e não tem volta por
 * aqui. Mas o único caminho antes deste script era abrir o Prisma Studio e marcar
 * linha a linha — sem confirmação, sem registro de quem fez, e com o banco aberto para
 * qualquer outra edição acidental ao lado.
 *
 * O que cancelar NÃO faz: liberar o número. O sequencial vem de MAX() sem filtrar
 * `cancelado`, então o contador não retrocede e o código morre ocupado. É marcação,
 * para que a consulta e a exportação mostrem que aquele código não vale mais.
 */

const LOG = "prisma/cancelamentos.log";

function agoraEmSuzano(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: FUSO_URE,
  }).format(new Date());
}

function encerrar(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

const args = process.argv.slice(2);
const semConfirmacao = args.includes("--sim");
const indicePor = args.indexOf("--por");
const por = indicePor >= 0 ? args[indicePor + 1] : undefined;
const loteId = args.find((a) => !a.startsWith("--") && a !== por);

if (!loteId) {
  encerrar(
    'Uso: npm run cancelar -- <id-do-lote> --por "Nome"\n\n' +
      "O id do lote aparece na tela de Consulta, na coluna Lote.\n" +
      "Use --sim para pular a confirmação (só em script; no uso normal, confirme).",
  );
}
if (!por || !por.trim()) {
  encerrar('Informe quem está cancelando: --por "Nome". Isso vai para o log.');
}

// Roda local contra o banco remoto. Conexao direta: o pooler existe para absorver
// conexao de serverless, e este script e um processo unico e de vida curta.
const prisma = criarPrismaClientDireto();

const lote = await prisma.lote.findUnique({
  where: { id: loteId },
  include: {
    escola: { select: { sigla: true, nome: true } },
    classe: { select: { sigla: true, nome: true } },
    codigos: { orderBy: { sequencial: "asc" } },
  },
});

if (!lote) {
  await prisma.$disconnect();
  encerrar(
    `Lote ${loteId} não encontrado.\n` +
      "Confira o id na tela de Consulta — é o do lote, não o do código.",
  );
}

const pendentes = lote.codigos.filter((c) => !c.cancelado);
const jaCancelados = lote.codigos.length - pendentes.length;

console.log(`Lote     ${lote.id}`);
console.log(`Escola   ${lote.escola.sigla} — ${lote.escola.nome}`);
console.log(`Classe   ${lote.classe.sigla} — ${lote.classe.nome}`);
console.log(`Ano      ${lote.ano}`);
console.log(`Descrição ${lote.descricao}`);
console.log(`Emitido por ${lote.emitidoPor} em ${lote.criadoEm.toISOString()}`);
console.log(
  `Códigos  ${lote.codigos.length} (${pendentes.length} a cancelar, ` +
    `${jaCancelados} já cancelado(s))`,
);

if (pendentes.length > 0) {
  const primeiro = pendentes[0].codigo;
  const ultimo = pendentes[pendentes.length - 1].codigo;
  console.log(
    pendentes.length === 1 ? `Alcance  ${primeiro}` : `Alcance  ${primeiro} … ${ultimo}`,
  );
}

if (pendentes.length === 0) {
  console.log("\nNada a fazer: todos os códigos deste lote já estão cancelados.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log(
  "\nCancelar NÃO libera os números: o sequencial não retrocede e estes códigos\n" +
    "seguem ocupados para sempre. Se algum já foi etiquetado em campo, a etiqueta\n" +
    "precisa sair do bem — o sistema não tem como saber disso.",
);

if (!semConfirmacao) {
  if (!process.stdin.isTTY) {
    await prisma.$disconnect();
    encerrar(
      "\nSem terminal interativo para confirmar. Rode no terminal, ou passe --sim se " +
        "for de dentro de um script.",
    );
  }
  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await leitor.question(
    `\nDigite CANCELAR para confirmar (${pendentes.length} código(s)): `,
  );
  leitor.close();
  if (resposta.trim() !== "CANCELAR") {
    await prisma.$disconnect();
    encerrar("Abortado. Nada foi alterado.");
  }
}

const { count } = await prisma.codigo.updateMany({
  where: { loteId: lote.id, cancelado: false },
  data: { cancelado: true },
});

const linha =
  `${agoraEmSuzano()}\tlote=${lote.id}\tescola=${lote.escola.sigla}\t` +
  `classe=${lote.classe.sigla}\tano=${lote.ano}\tcodigos=${count}\t` +
  `primeiro=${pendentes[0].codigo}\tultimo=${pendentes[pendentes.length - 1].codigo}\t` +
  `por=${por.trim()}\n`;

// O log é a única memória de quem cancelou o quê: não há coluna de auditoria na
// tabela. Se a escrita falhar, o cancelamento já aconteceu — avisa alto em vez de
// morrer em silêncio, para que alguém registre à mão.
try {
  await appendFile(LOG, linha, "utf8");
  console.log(`\n${count} código(s) cancelado(s). Registrado em ${LOG}.`);
} catch (erro) {
  console.error(
    `\n${count} código(s) cancelado(s), MAS não foi possível escrever em ${LOG}.\n` +
      "Anote manualmente:\n  " +
      linha.trim(),
    erro,
  );
}

await prisma.$disconnect();
