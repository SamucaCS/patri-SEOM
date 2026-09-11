-- RLS nas quatro tabelas do patrimônio.
--
-- O QUE ISSO PROTEGE, E O QUE NÃO PROTEGE
--
-- O Supabase publica automaticamente uma API REST (PostgREST) sobre o schema `public`,
-- acessível com a chave pública que está no navegador de qualquer visitante. Sem RLS,
-- estas quatro tabelas ficariam legíveis e graváveis por essa API — a base inteira de
-- escolas, CIEs e códigos, sem passar pela aplicação. É isso que estas políticas fecham.
--
-- O que RLS NÃO faz aqui: restringir a aplicação. O Prisma conecta como `postgres`, dono
-- das tabelas, e dono BYPASSA RLS por definição do Postgres. A barreira do app é a
-- sessão verificada em cada rota (`exigirOperador`), não isto. Quem ler este arquivo
-- esperando que ele limite o que o app pode fazer vai se enganar.
--
-- Estratégia: RLS ativo e NENHUMA política de acesso. Sem política, o padrão do Postgres
-- é negar tudo. Não há política permissiva porque não há caso de uso legítimo de acesso
-- a estas tabelas por fora do Prisma — nem leitura.

ALTER TABLE "Escola" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Classe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lote"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Codigo" ENABLE ROW LEVEL SECURITY;

-- FORCE faz a regra valer inclusive para o DONO da tabela.
--
-- Sem isso, `ENABLE` é inócuo para o papel que criou as tabelas. Com isso, mesmo uma
-- conexão privilegiada que caia aqui por engano encontra as tabelas fechadas.
--
-- A aplicação não é afetada: o Prisma conecta como `postgres`, que é SUPERUSER no
-- Supabase, e superuser ignora RLS mesmo com FORCE. É de propósito — é o que mantém o
-- app funcionando enquanto fecha a porta da API pública.
ALTER TABLE "Escola" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Classe" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Lote"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "Codigo" FORCE ROW LEVEL SECURITY;

-- Retira o privilégio dos papéis da API pública — SÓ das nossas quatro tabelas.
--
-- Aqui houve uma correção importante. A primeira versão fazia
-- `REVOKE ALL ON ALL TABLES IN SCHEMA public` mais `ALTER DEFAULT PRIVILEGES`, para que
-- qualquer tabela futura também nascesse fechada. Só que este banco Supabase é
-- COMPARTILHADO com outro sistema: há uma tabela `portal_docs` em `public` que não é
-- deste projeto. O `REVOKE` amplo teria tirado o acesso dela também, e o
-- `ALTER DEFAULT PRIVILEGES` afetaria toda tabela criada depois, por qualquer sistema.
--
-- O preço da correção: tabela nova DESTE projeto não nasce mais fechada
-- automaticamente. Por isso `npm run rls:conferir` existe e precisa rodar depois de
-- qualquer migration nova.
REVOKE ALL ON TABLE "Escola" FROM anon, authenticated;
REVOKE ALL ON TABLE "Classe" FROM anon, authenticated;
REVOKE ALL ON TABLE "Lote"   FROM anon, authenticated;
REVOKE ALL ON TABLE "Codigo" FROM anon, authenticated;
