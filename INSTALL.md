# Instalação e publicação

O sistema roda na **Vercel**, com banco **Postgres no Supabase**. Não há máquina do
setor, não há Node instalado em lugar nenhum, não há pen drive.

O que você precisa: uma conta na Vercel, uma conta no Supabase, e o repositório no
GitHub — que já existe, em <https://github.com/SamucaCS/patri-SEOM>.

> **Node local ainda é necessário para uma coisa:** aplicar migrations, rodar o seed e
> cancelar lote. São operações de manutenção, feitas da sua máquina contra o banco
> remoto. A aplicação em si não precisa de nada instalado.

---

## Por que não é SQLite

Ficou registrado porque a pergunta volta: a Vercel roda em função serverless, com
sistema de arquivos efêmero e **instâncias separadas**. Um arquivo SQLite ali seria
somente-leitura no build, e se fosse gravável cada instância teria a própria cópia —
duas emissões simultâneas leriam contadores diferentes e produziriam **o mesmo código**
para bens diferentes. Falha calada, e o sintoma aparece em campo, na etiqueta.

---

## Parte 1 — Supabase

### 1.1 Criar o projeto

Painel do Supabase → **New project**. Região **South America (São Paulo)**, que é
`sa-east-1`. Guarde a senha do banco que ele pede — ela vai nas duas connection
strings e não é recuperável depois, só redefinível.

### 1.2 Copiar as duas connection strings

**Project Settings → Database → Connection string.** Você precisa de **duas**, e elas
são diferentes de propósito:

| Variável | Porta | Modo | Para quê |
|----------|-------|------|----------|
| `DATABASE_URL` | **6543** | transaction | runtime da aplicação. Serverless abre muita conexão, e o pooler absorve isso. Precisa terminar com `?pgbouncer=true` |
| `DIRECT_URL` | **5432** | session | migrations, seed, scripts, **e a transação de emissão** |

**As duas saem do mesmo host do pooler** (`aws-0-<região>.pooler.supabase.com`), mudando
só a porta. Não use o host `db.<ref>.supabase.co`: em projeto novo ele é **IPv6 apenas**,
e máquina sem rota IPv6 recebe `ENETUNREACH`. IPv4 direto é add-on pago. O session
pooler na 5432 sustenta transação interativa e advisory lock igual à conexão direta —
foi verificado, não presumido.

**Acrescente `sslmode=no-verify` nas duas.** Sem isso o Node recusa o certificado do
pooler com `SELF_SIGNED_CERT_IN_CHAIN`. Isso mantém a conexão criptografada, mas **não
verifica a identidade do servidor** — ver "Dívida conhecida" no fim deste arquivo.

**Não troque as duas de lugar.** A transação de emissão pega um advisory lock para
serializar o contador; pelo pooler em *transaction mode*, os statements da mesma
transação podem cair em conexões diferentes, o lock deixa de valer para os seguintes, e
duas emissões voltam a ler o mesmo contador. Não dá erro — dá código duplicado.

O sistema tem duas defesas contra essa troca: `npm run verificar` tenta uma transação
interativa com advisory lock e acusa se não sustentar, e o harness de teste se recusa a
rodar se `DIRECT_URL` apontar para a porta 6543.

### 1.3 Copiar as chaves de autenticação

**Project Settings → API:**

- `NEXT_PUBLIC_SUPABASE_URL` — a URL do projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — a chave pública (anon / publishable)

Essas duas vão para o navegador e isso é esperado. Não há segredo nelas: quem autoriza é
a sessão do usuário, e as tabelas do patrimônio estão fechadas por RLS para qualquer
acesso vindo por essa chave.

### 1.4 Criar as tabelas e carregar as escolas

Da sua máquina, com o repositório clonado e `npm install` feito, crie um `.env` na raiz
(há modelo em `.env.example`) com as quatro variáveis. Então:

```
npm run db:deploy      # cria as tabelas e aplica o RLS
npm run db:seed        # carrega as 64 unidades e as 3 classes
npm run verificar      # confirma que está tudo de pé
npm run rls:conferir   # confirma RLS tabela por tabela
```

`npm run verificar` precisa terminar com:

```
Banco: 64 escolas, 3 classes, 0 códigos.
Nenhum problema encontrado.
```

**Se o número de códigos não for 0**, pare: emitir a partir de um banco com códigos de
teste embaralha o sequencial, e código emitido nunca é reaproveitado.

`npm run rls:conferir` precisa mostrar todas as tabelas com RLS **ativo** e **forçado**,
zero políticas permissivas, e nenhum privilégio para `anon`/`authenticated`. Ele sai com
erro se qualquer tabela estiver descoberta.

### 1.5 Criar os usuários — um por um, na mão

**Authentication → Users → Add user**, com **Create new user** e senha definida por
você. Marque *Auto Confirm User*.

Não existe cadastro aberto, não existe recuperação de senha por e-mail e não existe
convite por link. Isso é decisão, não pendência: são poucas pessoas, todas conhecidas, e
a alternativa seria uma superfície de auto-cadastro num sistema que emite identificador
de patrimônio.

Para que o nome da pessoa apareça em "Emitido por" em vez do e-mail, preencha o
**User Metadata** com:

```json
{ "nome": "Samuel Silva" }
```

Sem isso, "Emitido por" grava o e-mail. Funciona, mas fica feio na planilha.

### 1.6 Desligar o auto-cadastro

**Authentication → Providers → Email:** deixe *Enable email provider* ligado e
**desligue _Enable sign ups_**. Sem isso, qualquer pessoa com a URL cria a própria conta
e passa a emitir código de patrimônio.

Confirme também que os outros provedores (Google, GitHub, etc.) estão desligados.

---

## Parte 2 — Vercel

### 2.1 Importar o repositório

Painel da Vercel → **Add New → Project** → importe `SamucaCS/patri-SEOM`. Framework
detectado: Next.js. Não mude nada de build.

### 2.2 Variáveis de ambiente

Antes do primeiro deploy, em **Environment Variables**, as quatro:

```
DATABASE_URL                    (pooler, 6543, com ?pgbouncer=true)
DIRECT_URL                      (direta, 5432)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Marque as quatro para **Production**, **Preview** e **Development**.

Sem `DATABASE_URL`/`DIRECT_URL` a aplicação sobe e falha na primeira consulta. Sem as
duas do Supabase, o middleware **falha fechado** e manda todo mundo para o login, que
por sua vez não consegue autenticar — a tela responde, mas ninguém entra. Foi escolhido
assim de propósito: melhor ninguém entrar do que todos entrarem sem sessão.

### 2.3 Publicar

**Deploy.** Ao terminar, abra a URL: precisa cair na tela de login. Entre com um dos
usuários criados no passo 1.5 e confirme que:

- a tela de emissão abre e mostra seu nome em "Emitido por";
- "Emitido por" **não é editável** — é a sua sessão;
- a consulta lista e a exportação baixa o `.xlsx`;
- **Sair** derruba a sessão e volta ao login;
- abrir a URL numa janela anônima cai no login, sem ver dado nenhum.

---

## Parte 3 — Backup, e como restaurar

Backup que nunca foi restaurado não é backup. Esta seção tem as duas metades.

### 3.1 O que o Supabase faz sozinho

**Database → Backups** no painel. **O que existe ali depende do seu plano** — confira
antes de contar com isso:

- plano gratuito: sem backup automático garantido;
- planos pagos: backup diário, com retenção conforme o plano;
- PITR (recuperação a um instante exato): add-on separado.

**Se o painel não mostrar backup diário, o item 3.2 não é opcional.**

### 3.2 Backup manual — funciona em qualquer plano

Da sua máquina, semanalmente:

```
pg_dump "$DIRECT_URL" -Fc -f emissor-2026-09-10.dump
```

Precisa do `pg_dump` instalado (vem com o PostgreSQL client). Guarde o arquivo no
SharePoint do setor, com a data no nome.

### 3.3 A segunda cópia, que não depende de banco

Exportar o `.xlsx` pela tela de Consulta, **sem filtro**, e enviar ao SharePoint.

Isso não é redundância boba: é a única cópia legível sem Postgres, sem credencial e sem
ferramenta. Se o Supabase ficar inacessível, é o que responde "qual código já foi
emitido" — que é a pergunta cuja resposta errada gera patrimônio duplicado.

### 3.4 Como restaurar

**Para um instante anterior, no mesmo projeto** (precisa de PITR no plano):
Database → Backups → escolha o ponto → **Restore**. Derruba o banco por alguns minutos.

**De um `.dump` para um projeto novo:**

1. Crie um projeto Supabase novo.
2. Pegue a `DIRECT_URL` dele.
3. Restaure:

   ```
   pg_restore -d "$DIRECT_URL_NOVA" --no-owner --no-privileges emissor-2026-09-10.dump
   ```

4. Rode `npm run rls:conferir` apontando para o banco novo. **`--no-privileges` não
   traz os privilégios, então o RLS precisa ser reaplicado:**

   ```
   npm run db:deploy
   ```

5. Rode `npm run verificar` e confira a contagem de códigos contra o último `.xlsx`
   exportado.
6. Recrie os usuários — `pg_restore` do banco **não traz o Authentication**. Essa é a
   pegadinha desta arquitetura: banco e usuários são backups separados.
7. Atualize as quatro variáveis na Vercel e faça um redeploy.

### 3.5 Faça isso uma vez, antes de considerar pronto

Restaure um `.dump` num projeto Supabase descartável, seguindo o 3.4 inteiro, e confira
a contagem de códigos. **Peça para outra pessoa fazer**, seguindo só este texto. Se ela
travar em algum passo, o texto está errado — não ela.

---

## Quando não funcionar

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| tudo cai no login, mesmo com senha certa | falta `NEXT_PUBLIC_SUPABASE_*` na Vercel | confira as 4 variáveis e faça redeploy |
| "E-mail ou senha incorretos" com senha certa | usuário não confirmado | painel → Users → Auto Confirm |
| `verificar` acusa que a conexão de emissão não sustentou advisory lock | `DIRECT_URL` está no pooler (6543) | troque para 5432 |
| erro de "too many connections" | a aplicação está usando a direta em runtime | `DATABASE_URL` precisa ser a 6543 com `?pgbouncer=true` |
| `SEQUENCIAL_DUPLICADO` na emissão | o advisory lock não está protegendo | é bug, não contenção. Veja o log do servidor: ele diz o que suspeitar, em ordem |
| testes recusam rodar citando porta 6543 | `DIRECT_URL` errada no `.env` local | idem: 5432 |
| `Cannot find module '../src/generated/prisma/client'` | client do Prisma não gerado | `npm run db:generate` |
| a exportação devolve 401 | sem sessão | entre no sistema |

O comando que responde a maior parte das dúvidas:

```
npm run verificar
```

Ele conta escolas, classes e códigos, checa se a conexão de emissão sustenta transação
com advisory lock, e confirma que todo código gravado ainda bate com a sigla atual da
escola e da classe.

---

## Cancelar um lote

Não tem tela, e o caminho é a sua máquina contra o banco remoto:

```
npm run cancelar -- <id-do-lote> --por "Seu nome"
```

Ele mostra o lote inteiro, exige que você digite `CANCELAR`, cancela todos os códigos
daquele lote e registra em `prisma/cancelamentos.log`.

Dois avisos que valem mais desde a migração:

- **O log fica na sua máquina, não no banco.** Quem cancelar de outro computador gera um
  log lá. Se isso passar a acontecer, o registro precisa virar tabela.
- **Cancelar não libera número.** O sequencial não retrocede e aqueles códigos seguem
  ocupados para sempre.

---

## O que NÃO fazer

- **Não** aponte `DATABASE_URL` para a porta 5432 "para simplificar". A aplicação
  esgotaria as conexões do Postgres na primeira hora de uso real.
- **Não** aponte `DIRECT_URL` para o pooler. É a falha calada desta arquitetura.
- **Não** ligue *Enable sign ups* no Supabase.
- **Não** use a `service_role key` na aplicação. Ela ignora RLS; não há motivo para ela
  existir aqui.
- **Não** crie tabela nova sem RLS. Tabela nova nasce **descoberta**, e a API REST do
  Supabase a publica. Rode `npm run rls:conferir` depois de qualquer migration.

---

## TLS: verificação completa, via variável de ambiente

As connection strings **não** usam `sslmode`. A verificação vem da CA carregada em
`SUPABASE_CA_CERT`, como **conteúdo PEM** — não caminho de arquivo. Em deploy
serverless não há sistema de arquivos confiável para apontar, e caminho relativo quebra
dependendo de onde o processo sobe.

Isso dá `verify-full`: valida a cadeia **e** o hostname. Foi medido contra
`aws-0-us-west-2.pooler.supabase.com` antes de entrar.

**Sem a CA o sistema falha, de propósito.** O estado anterior era `sslmode=no-verify`,
que criptografa mas aceita qualquer certificado — não protege contra alguém no meio do
caminho. Degradar em silêncio para o modo fraco seria pior que parar.

### Onde pegar

Painel → Settings → Database → **SSL Configuration** → *Download certificate*. Cole o
PEM numa linha só, com `
` no lugar das quebras. O código aceita as duas formas
(quebras reais ou `
` escapado).

### A exceção: o CLI do Prisma

O CLI só entende `sslrootcert`, que é caminho de arquivo — ele não aceita PEM em
memória. Por isso `prisma7.config.ts` **deriva** um arquivo temporário da variável a
cada execução. A variável continua sendo a fonte da verdade; o arquivo é artefato.

Sem isso, migration teria que rodar com `sslmode=no-verify` — justamente o modo que
saiu do resto do sistema.
