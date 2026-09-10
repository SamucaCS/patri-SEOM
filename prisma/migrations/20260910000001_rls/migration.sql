-- RLS em TODAS as tabelas do patrimônio.
--
-- O QUE ISSO PROTEGE, E O QUE NÃO PROTEGE
--
-- O Supabase publica automaticamente uma API REST (PostgREST) sobre o schema `public`,
-- acessível com a chave pública (anon), que está no navegador de qualquer visitante.
-- Sem RLS, essas quatro tabelas ficariam legíveis e graváveis por essa API — a base
-- inteira de escolas, CIEs e códigos, sem passar pela aplicação. É isso que estas
-- políticas fecham.
--
-- O que RLS NÃO faz aqui: restringir a aplicação. O Prisma conecta como dono das
-- tabelas, e dono BYPASSA RLS por definição do Postgres. A barreira do app é a sessão
-- verificada em cada rota (`exigirOperador`), não isto. Quem ler este arquivo
-- esperando que ele limite o que o app pode fazer vai se enganar.
--
-- Estratégia: RLS ativo e NENHUMA política de acesso. Sem política, o padrão do
-- Postgres é negar tudo. Não há política permissiva porque não há caso de uso legítimo
-- de acesso às tabelas de patrimônio por fora do Prisma — nem leitura.

ALTER TABLE "Escola" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Classe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lote"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Codigo" ENABLE ROW LEVEL SECURITY;

-- FORCE faz a regra valer inclusive para o DONO da tabela.
--
-- Sem isso, `ENABLE` é inócuo para o papel que criou as tabelas. Com isso, mesmo uma
-- conexão privilegiada que caia no schema por engano — um `psql` aberto, um script
-- rodando com a service key — encontra as tabelas fechadas.
--
-- A aplicação não é afetada: o Prisma conecta como `postgres`, que é SUPERUSER no
-- Supabase, e superuser ignora RLS mesmo com FORCE. É de propósito: é o que mantém o
-- app funcionando enquanto fecha a porta da API pública.
ALTER TABLE "Escola" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Classe" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Lote"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "Codigo" FORCE ROW LEVEL SECURITY;

-- Retira o privilégio dos papéis da API pública, além do RLS.
--
-- Cinto e suspensório de propósito: RLS depende de estar ativo em cada tabela, e uma
-- tabela nova criada por migration futura entra SEM RLS. Revogar no schema faz a
-- próxima tabela nascer inacessível para a API, mesmo que alguém esqueça o ALTER.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
