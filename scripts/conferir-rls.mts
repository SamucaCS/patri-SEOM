import "dotenv/config";
import pg from "pg";
import { opcoesSslPg } from "../src/lib/prisma";

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
 *
 * Este banco Supabase é COMPARTILHADO com outro sistema (há uma `portal_docs` em
 * `public` que não é deste projeto). Por isso o script separa as nossas quatro tabelas
 * das alheias: só as nossas contam para o código de saída. Tabela de outro sistema é
 * listada como informação — fechá-la não é decisão nossa, e mexer nela quebraria algo
 * que não conhecemos.
 */

/** As tabelas deste projeto. Só estas determinam sucesso ou falha. */
const NOSSAS = ["Escola", "Classe", "Lote", "Codigo", "_prisma_migrations"];

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL nao definida. Confira o .env.");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url, ssl: opcoesSslPg() });
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
    -- has_table_privilege, e NAO information_schema.role_table_grants.
    --
    -- information_schema so mostra o que o usuario ATUAL tem direito de enxergar.
    -- Medido: rodando como o papel emissor, ele reportava ZERO privilegios numa tabela de
    -- outro dono que na verdade tinha SELECT, INSERT, UPDATE e DELETE abertos para
    -- anon. Era falso negativo - o script diria "limpo" para uma tabela escancarada.
    -- has_table_privilege responde a pergunta real e nao depende de quem pergunta.
    COALESCE((
      SELECT string_agg(x.papel || ':' || x.priv, ', ' ORDER BY x.papel, x.priv)
      FROM (
        SELECT r.rolname AS papel, p.priv
        FROM (VALUES ('anon'), ('authenticated')) r(rolname),
             (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
        WHERE has_table_privilege(r.rolname, c.oid, p.priv)
      ) x
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

const largura = Math.max(8, ...rows.map((r) => r.tabela.length));
const cab =
  `${"tabela".padEnd(largura)}  dono        RLS      FORCE    políticas  ` +
  "privilégio anon/authenticated";
console.log(cab);
console.log("-".repeat(cab.length));

let descobertas = 0;
let alheias = 0;

for (const r of rows) {
  const nossa = NOSSAS.includes(r.tabela);
  const rls = r.rls ? "ativo" : "AUSENTE";
  const forcado = r.forcado ? "sim" : "NAO";
  const vazado = r.privilegios_publicos !== "-";
  const problema = !r.rls || !r.forcado || vazado;

  if (nossa && problema) descobertas++;
  if (!nossa) alheias++;

  console.log(
    `${r.tabela.padEnd(largura)}  ${(nossa ? "emissor" : "OUTRO").padEnd(10)}  ` +
      `${rls.padEnd(7)}  ${forcado.padEnd(7)}  ${r.politicas.padStart(9)}  ` +
      `${vazado ? r.privilegios_publicos : "nenhum"}`,
  );
}

const faltando = NOSSAS.filter((t) => !rows.some((r) => r.tabela === t));
for (const t of faltando) {
  console.log(`${t.padEnd(largura)}  ${"emissor".padEnd(10)}  NAO EXISTE`);
}

console.log("");
console.log(
  `${rows.length} tabela(s) em public: ${rows.length - alheias} do emissor, ` +
    `${alheias} de outro sistema.`,
);

if (faltando.length > 0) {
  console.error(
    `\nFaltam tabelas do emissor: ${faltando.join(", ")}. Rode: npm run db:deploy`,
  );
  process.exit(1);
}

if (descobertas > 0) {
  console.error(
    `\n${descobertas} tabela(s) DO EMISSOR com problema. RLS precisa estar ATIVO e ` +
      "FORÇADO, e os papéis anon/authenticated não devem ter privilégio nenhum.\n" +
      "Corrija aplicando a migration de RLS: npm run db:deploy",
  );
  process.exit(1);
}

if (alheias > 0) {
  console.warn(
    `\nAviso: ${alheias} tabela(s) em public não são deste projeto. O estado de RLS ` +
      "delas é responsabilidade de quem as criou - este script não as avalia e a\n" +
      "migration de RLS deste projeto não as toca.",
  );
}

console.log(
  "Todas as tabelas com RLS ativo e forçado, sem política permissiva e sem\n" +
    "privilégio para os papéis da API pública.\n\n" +
    "Lembrete: isto fecha a API REST do Supabase. NÃO restringe a aplicação — o\n" +
    "Prisma conecta como dono e bypassa RLS. A barreira do app é a sessão em cada rota.",
);
