import "dotenv/config";
import pg from "pg";
import { opcoesSslPg } from "../src/lib/prisma";

/**
 * Cria (ou atualiza) o papel `emissor`, dono das tabelas deste projeto.
 *
 * POR QUE ESTE PAPEL EXISTE
 *
 * O banco Supabase é compartilhado com outro sistema (a tabela `portal_docs`). Se a
 * aplicação conectasse como `postgres`, rotacionar a senha do emissor derrubaria o
 * outro sistema junto — e vice-versa. Papel próprio, senha própria, rotação
 * independente.
 *
 * POR QUE BYPASSRLS
 *
 * As tabelas estão com `FORCE ROW LEVEL SECURITY` e **zero políticas**, o que nega tudo
 * para todo mundo, inclusive o dono. Sem `BYPASSRLS` a aplicação não leria as próprias
 * tabelas. O RLS aqui existe para fechar a API REST do Supabase, não para limitar o
 * app. E nao ha login: pela tela nao ha barreira nenhuma, por decisao do cliente.
 *
 * COMO USAR
 *
 *   ADMIN_URL="postgresql://postgres.<ref>:<senha-do-postgres>@<host>:5432/postgres" \
 *   SENHA_EMISSOR="<senha-nova>" \
 *   npm run papel:criar
 *
 * É idempotente: rodar de novo só atualiza a senha e reaplica as concessões.
 */

const adminUrl = process.env.ADMIN_URL;
const senha = process.env.SENHA_EMISSOR;

if (!adminUrl || !senha) {
  console.error(
    "Faltam variáveis.\n\n" +
      "  ADMIN_URL     conexão como `postgres` (o papel administrador do projeto)\n" +
      "  SENHA_EMISSOR senha nova para o papel `emissor`\n\n" +
      'Exemplo:\n  ADMIN_URL="postgresql://postgres.REF:SENHA@HOST:5432/postgres" \\\n' +
      '  SENHA_EMISSOR="..." npm run papel:criar',
  );
  process.exit(1);
}

if (senha.length < 20) {
  console.error("SENHA_EMISSOR muito curta. Use ao menos 20 caracteres.");
  process.exit(1);
}

const NOSSAS = ["Escola", "Classe", "Lote", "Codigo", "_prisma_migrations"];

const c = new pg.Client({ connectionString: adminUrl, ssl: opcoesSslPg() });
await c.connect();

const existe = await c.query("SELECT 1 FROM pg_roles WHERE rolname='emissor'");

const passos: Array<[string, string]> = [
  existe.rowCount
    ? ["ALTER ROLE emissor LOGIN BYPASSRLS PASSWORD $senha$" + senha + "$senha$", "atualiza senha e BYPASSRLS"]
    : ["CREATE ROLE emissor LOGIN BYPASSRLS PASSWORD $senha$" + senha + "$senha$", "cria o papel"],

  // Sem ser membro, o admin não pode transferir dono nem mexer no default do emissor.
  ["GRANT emissor TO CURRENT_USER", "admin vira membro de emissor"],

  ["GRANT USAGE ON SCHEMA public TO emissor", "usar o schema"],
  // CREATE no schema é exigido para ser dono de tabela, e para migration futura.
  ["GRANT CREATE ON SCHEMA public TO emissor", "criar no schema"],
  // CREATE no banco é o que permite ao harness de teste criar schemas temporários.
  ["GRANT CREATE ON DATABASE postgres TO emissor", "criar schema (testes)"],
];

for (const t of NOSSAS) {
  passos.push([`ALTER TABLE IF EXISTS "${t}" OWNER TO emissor`, `dono de ${t}`]);
}

// Rede de segurança. Na prática é no-op: o grant amplo para anon/authenticated vem do
// default ACL do papel `postgres`, e tabela criada por `emissor` não o herda. Fica
// explícito para o caso de alguém conceder defaults ao emissor no futuro.
for (const tipo of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
  passos.push([
    `ALTER DEFAULT PRIVILEGES FOR ROLE emissor IN SCHEMA public REVOKE ALL ON ${tipo} FROM anon, authenticated`,
    `default: ${tipo.toLowerCase()}`,
  ]);
}

let falhas = 0;
for (const [sql, nome] of passos) {
  try {
    await c.query(sql);
    console.log(`  ok    ${nome}`);
  } catch (e) {
    falhas++;
    console.error(`  FALHA ${nome}: ${(e as Error).message.split("\n")[0]}`);
  }
}

const r = await c.query(
  "SELECT rolbypassrls FROM pg_roles WHERE rolname='emissor'",
);
console.log(`\nemissor: BYPASSRLS = ${r.rows[0]?.rolbypassrls}`);

const donos = await c.query(
  "SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' ORDER BY 1",
);
console.log("\ntabela                  dono");
for (const x of donos.rows) {
  console.log("  " + x.tablename.padEnd(22) + x.tableowner);
}

await c.end();

if (falhas > 0) {
  console.error(`\n${falhas} passo(s) falharam. Nada foi revertido — confira acima.`);
  process.exit(1);
}

console.log(
  "\nAgora aponte DIRECT_URL e DATABASE_URL para o usuário " +
    "`emissor.<ref>` com a senha nova, e rode `npm run verificar`.",
);
