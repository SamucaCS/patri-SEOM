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

**Não acrescente `sslmode` nenhum nas duas** — nem `require`, nem `no-verify`. O código
remove esse parâmetro de propósito e monta a verificação de TLS a partir da CA em
`SUPABASE_CA_CERT`, que é verificação completa. Um `sslmode` na URL venceria essa
montagem e voltaria ao modo fraco sem avisar. Ver "TLS" no fim deste arquivo.

**Não troque as duas de lugar.** A transação de emissão pega um advisory lock para
serializar o contador; pelo pooler em *transaction mode*, os statements da mesma
transação podem cair em conexões diferentes, o lock deixa de valer para os seguintes, e
duas emissões voltam a ler o mesmo contador. Não dá erro — dá código duplicado.

O sistema tem duas defesas contra essa troca: `npm run verificar` tenta uma transação
interativa com advisory lock e acusa se não sustentar, e o harness de teste se recusa a
rodar se `DIRECT_URL` apontar para a porta 6543.

### 1.3 Criar as tabelas e carregar as escolas

Da sua máquina, com o repositório clonado e `npm install` feito, crie um `.env` na raiz
(há modelo em `.env.example`) com as três variáveis. Então:

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

### 1.4 Fechar o Auth do Supabase, que o sistema não usa

**Não há login neste sistema** — ver "Sem autenticação" no [README](README.md#sem-autenticação).
Não crie usuário: quem tiver a URL usa o sistema, e "Emitido por" é um campo digitado.

Mesmo assim, feche o Auth do projeto, porque o Supabase o publica de qualquer jeito:
**Authentication → Providers → Email:** desligue *Enable sign ups*, e confirme que os
outros provedores (Google, GitHub, etc.) estão desligados. Conta criada ali não abre
nada — as tabelas estão sob `FORCE RLS` sem nenhuma política, e a API REST nega tudo —
mas endpoint de cadastro aberto sem ninguém olhando não serve a nada.

---

## Parte 2 — Vercel

### 2.1 Importar o repositório

Painel da Vercel → **Add New → Project** → importe `SamucaCS/patri-SEOM`. Framework
detectado: Next.js. Não mude nada de build.

### 2.2 Variáveis de ambiente

Antes do primeiro deploy, em **Environment Variables**, as três:

```
DATABASE_URL                    (pooler, 6543, com ?pgbouncer=true)
DIRECT_URL                      (direta, 5432)
SUPABASE_CA_CERT                (o PEM inteiro, sem aspas — ver TLS, no fim)
```

Marque as três para **Production**, **Preview** e **Development**.

Sem `DATABASE_URL`/`DIRECT_URL` a aplicação sobe e falha na primeira consulta. Sem
`SUPABASE_CA_CERT` ela **falha de propósito**, em vez de conectar sem verificar o
certificado do servidor.

### 2.3 Publicar

**Deploy.** Ao terminar, abra a URL — ela abre direto na tela de emissão, sem login.
Confirme que:

- a tela de emissão abre com as 64 escolas e as 3 classes nos seletores;
- "Emitido por" é um campo de texto, e o nome digitado fica lembrado na próxima vez;
- escolher escola e classe mostra o sequencial atual do trio;
- a consulta lista e a exportação baixa o `.xlsx`;
- nenhuma tela pede senha — se alguma pedir, sobrou código de autenticação.

**Confirme também o outro lado disso:** abrir a URL numa janela anônima dá acesso
completo, e é assim por decisão. Quem tiver o endereço emite código e baixa a base.

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
6. Feche o Auth do projeto novo (1.4). O sistema não o usa, mas projeto novo nasce com
   *sign ups* ligado.
7. Atualize as três variáveis na Vercel e faça um redeploy — `SUPABASE_CA_CERT` é do
   projeto novo, não do antigo.

### 3.5 Faça isso uma vez, antes de considerar pronto

Restaure um `.dump` num projeto Supabase descartável, seguindo o 3.4 inteiro, e confira
a contagem de códigos. **Peça para outra pessoa fazer**, seguindo só este texto. Se ela
travar em algum passo, o texto está errado — não ela.

---

## Quando não funcionar

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| a aplicação sobe mas erra na primeira consulta | falta `DATABASE_URL`/`DIRECT_URL` na Vercel | confira as 3 variáveis e faça redeploy |
| `P1011: self-signed certificate in certificate chain` | a CA não chegou — valor truncado, com aspas sobrando, ou ausente | recole o PEM inteiro (qualquer formato serve) e **redeploy**; ver TLS, no fim |
| `SUPABASE_CA_CERT nao parece ser um PEM` / `vazio ou truncado` | o valor chegou cortado ou com lixo em volta | recole do `-----BEGIN` ao `-----END`, sem aspas |
| `verificar` acusa que a conexão de emissão não sustentou advisory lock | `DIRECT_URL` está no pooler (6543) | troque para 5432 |
| erro de "too many connections" | a aplicação está usando a direta em runtime | `DATABASE_URL` precisa ser a 6543 com `?pgbouncer=true` |
| `SEQUENCIAL_DUPLICADO` na emissão | o advisory lock não está protegendo | é bug, não contenção. Veja o log do servidor: ele diz o que suspeitar, em ordem |
| testes recusam rodar citando porta 6543 | `DIRECT_URL` errada no `.env` local | idem: 5432 |
| `Cannot find module '../src/generated/prisma/client'` | client do Prisma não gerado | `npm run db:generate` |

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
- **Não** ligue *Enable sign ups* no Supabase. O sistema não usa Auth; o endpoint
  ficaria aberto sem servir a nada.
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
conteúdo do arquivo no campo *Value*, **sem aspas** e sem o nome da variável junto.

**Qualquer formato de colagem serve**, e isso não é detalhe de conveniência — custou o
primeiro deploy. O código normaliza o PEM antes de usar: quebras de linha reais, `\n`
escapado (campo de uma linha), ou as quebras viradas em espaço pelo caminho, tudo vira o
mesmo certificado. O que **não** serve é valor truncado ou com aspas sobrando; nesse caso
ele falha dizendo exatamente isso.

**Por que a normalização existe.** No primeiro deploy o PEM chegou à Vercel com as
quebras viradas em espaço. O OpenSSL **descarta um PEM assim em silêncio** — não existe
erro de "certificado malformado". A conexão passa a ser validada contra o store padrão,
que não conhece a CA privada do Supabase, e o Postgres responde
`P1011: self-signed certificate in certificate chain`. A mensagem manda investigar o
servidor, o pooler, o `sslmode` — e o defeito estava na colagem. `src/lib/prisma.test.ts`
trava os três formatos.

### A exceção: o CLI do Prisma

O CLI só entende `sslrootcert`, que é caminho de arquivo — ele não aceita PEM em
memória. Por isso `prisma7.config.ts` **deriva** um arquivo temporário da variável a
cada execução. A variável continua sendo a fonte da verdade; o arquivo é artefato.

Sem isso, migration teria que rodar com `sslmode=no-verify` — justamente o modo que
saiu do resto do sistema.
