import "dotenv/config";
import { defineConfig } from "prisma/config";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Migrations usam a conexao em SESSION MODE (porta 5432), nunca o pooler em transaction
 * mode (6543).
 *
 * O pooler em transaction mode nao sustenta DDL em transacao, nem os advisory locks que
 * o proprio `prisma migrate` pega para nao rodar duas vezes ao mesmo tempo. Apontar
 * migration para lá falha de formas dificeis de ler.
 */

/**
 * TLS para o CLI do Prisma.
 *
 * O resto do sistema carrega a CA de `SUPABASE_CA_CERT` e a passa ao driver em memoria.
 * O CLI do Prisma nao aceita isso: ele so entende `sslrootcert`, que e CAMINHO DE
 * ARQUIVO. Entao aqui a variavel continua sendo a fonte da verdade, e o arquivo e um
 * artefato derivado dela, escrito num diretorio temporario a cada execucao.
 *
 * Sem isso, migration teria que rodar com `sslmode=no-verify` - justamente o modo fraco
 * que saiu do resto do sistema.
 */
function urlComCaVerificada(url: string): string {
  const bruto = process.env.SUPABASE_CA_CERT?.trim();
  if (!bruto) {
    throw new Error(
      "SUPABASE_CA_CERT nao definida. As migrations tambem verificam a identidade do " +
        "servidor; sem a CA nao ha como. Ver INSTALL.md.",
    );
  }

  const pem = bruto.includes("\\n") ? bruto.replace(/\\n/g, "\n") : bruto;
  const arquivo = join(mkdtempSync(join(tmpdir(), "prisma-ca-")), "ca.crt");
  writeFileSync(arquivo, pem, "utf8");

  // Tira sslmode antigo para nao deixar `no-verify` vencer a verificacao.
  const limpa = url.replace(/([?&])sslmode=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  const separador = limpa.includes("?") ? "&" : "?";

  return (
    `${limpa}${separador}sslmode=verify-full` +
    `&sslrootcert=${encodeURIComponent(arquivo)}`
  );
}

const url = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];
if (!url) throw new Error("DIRECT_URL (ou DATABASE_URL) nao definida.");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: urlComCaVerificada(url),
  },
});
