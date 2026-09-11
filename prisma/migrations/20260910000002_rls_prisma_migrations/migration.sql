-- Fecha a `_prisma_migrations`, que ficou de fora da migration anterior.
--
-- Como o furo apareceu: `npm run rls:conferir` lista TODAS as tabelas de `public`, e
-- mostrou esta com RLS ausente e privilégio completo para `anon` e `authenticated` —
-- isto é, legível e gravável pela API REST pública do Supabase.
--
-- Por que ela escapou: o Prisma cria essa tabela sozinho, na primeira migration, então
-- ela não aparece no `schema.prisma` e não estava na lista das quatro. Foi a conferência
-- tabela por tabela que pegou; olhar só o schema não pegaria.
--
-- Por que importa, mesmo sendo "só" o histórico de migrations:
--   - LEITURA entrega os nomes das migrations, o que revela a estrutura do sistema;
--   - ESCRITA é o problema sério. Apagar ou alterar uma linha aqui faz o Prisma achar
--     que uma migration já aplicada não foi, ou o contrário. Um `INSERT` forjado pode
--     travar todo deploy futuro, e um `DELETE` pode fazer o próximo `migrate deploy`
--     tentar recriar tabela que já existe.
--
-- A aplicação não é afetada: o Prisma conecta como `postgres`, superuser, que ignora
-- RLS mesmo com FORCE.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
