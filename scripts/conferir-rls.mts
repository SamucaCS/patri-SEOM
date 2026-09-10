import "dotenv/config";
import pg from "pg";

/**
 * Confere RLS tabela por tabela, no schema `public` do banco real.
 *
 * Existe porque "ativei RLS" é fácil de dizer e difícil de verificar: uma tabela nova
 * criada por migration futura nasce SEM RLS, e nada avisa. Este script sai com código 1
 * se qualquer tabela estiver descoberta, então serve de passo de conferência antes de
 * publicar.
 *
 * O que ele checa em cada tabela:
 *   - rowsecurity  : RLS está ativo?
 *   - forced       : vale também para o dono da tabela?
 *   - políticas    : quantas políticas de acesso existem (esperado: 0 = nega tudo)
 *   - anon/auth    : os papéis da API pública têm algum privilégio sobrando?
 */

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL nao definida. Confira o .env.");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

const { rows } = await cliente.query<{
  tabela: string;
  rls: boolean;
  forcado: boolean;
  politicas: string;
  privilegios_publicos: string;
}>(`
  SELECT
    c.relname AS tabela,
    c.relrowsecurity AS rls,
    c.relforcerowsecurity AS forcado,
    (SELECT count(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname)::text AS politicas,
    COALESCE((
      SELECT string_agg(DISTINCT g.privilege_type, ', ' ORDER BY g.privilege_type)
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public'
        AND g.table_name = c.relname
        AND g.grantee IN ('anon', 'authenticated')
    ), '-') AS privilegios_publicos
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
`);

await cliente.end();

if (rows.length === 0) {
  console.error("Nenhuma tabela encontrada em public. As migrations foram aplicadas?");
  process.exit(1);
}

const largura = Math.max(6, ...rows.map((r) => r.tabela.length));
const cab = `${"tabela".padEnd(largura)}  RLS      FORCE    políticas  privilégio anon/authenticated`;
console.log(cab);
console.log("-".repeat(cab.length));

let descobertas = 0;

for (const r of rows) {
  const rls = r.rls ? "ativo" : "AUSENTE";
  const forcado = r.forcado ? "sim" : "NAO";
  const vazado = r.privilegios_publicos !== "-";

  if (!r.rls || !r.forcado || vazado) descobertas++;

  console.log(
    `${r.tabela.padEnd(largura)}  ${rls.padEnd(7)}  ${forcado.padEnd(7)}  ` +
      `${r.politicas.padStart(9)}  ${vazado ? r.privilegios_publicos : "nenhum"}`,
  );
}

console.log("");
console.log(`${rows.length} tabela(s) em public.`);

if (descobertas > 0) {
  console.error(
    `\n${descobertas} tabela(s) com problema. RLS precisa estar ATIVO e FORÇADO, e os ` +
      "papéis anon/authenticated não devem ter privilégio nenhum.\n" +
      "Corrija aplicando a migration de RLS: npm run db:deploy",
  );
  process.exit(1);
}

console.log(
  "Todas as tabelas com RLS ativo e forçado, sem política permissiva e sem\n" +
    "privilégio para os papéis da API pública.\n\n" +
    "Lembrete: isto fecha a API REST do Supabase. NÃO restringe a aplicação — o\n" +
    "Prisma conecta como dono e bypassa RLS. A barreira do app é a sessão em cada rota.",
);
