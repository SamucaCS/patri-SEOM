import "dotenv/config";
import { verificarIntegridade } from "../src/lib/boot";
import { criarPrismaClient, garantirWal } from "../src/lib/prisma";

/**
 * Verificação de integridade pela linha de comando.
 *
 * Roda depois de restaurar um backup, depois de aplicar migration, ou sempre que o
 * banco tiver sido tocado por fora. Sai com código 1 se achar erro, para poder virar
 * passo de um script de manutenção.
 */

const prisma = criarPrismaClient();
await garantirWal(prisma);

const problemas = await verificarIntegridade(prisma);

const erros = problemas.filter((p) => p.nivel === "erro");
const avisos = problemas.filter((p) => p.nivel === "aviso");

const [escolas, classes, codigos] = await Promise.all([
  prisma.escola.count(),
  prisma.classe.count(),
  prisma.codigo.count(),
]);

console.log(`Banco: ${escolas} escolas, ${classes} classes, ${codigos} códigos.`);

if (problemas.length === 0) {
  console.log("Nenhum problema encontrado.");
} else {
  for (const p of erros) console.error(`  ERRO   ${p.mensagem}`);
  for (const p of avisos) console.warn(`  aviso  ${p.mensagem}`);
  console.log(`\n${erros.length} erro(s), ${avisos.length} aviso(s).`);
}

await prisma.$disconnect();
process.exit(erros.length > 0 ? 1 : 0);
