# Emissor de Códigos de Patrimônio — SEOM / URE Suzano

Emissor centralizado de códigos de patrimônio. Gera códigos **únicos, válidos e
rastreáveis**, que são digitados no sistema que o SEOM já usa.

Ele **não** gerencia patrimônio, não faz inventário e não substitui o sistema
existente. Uso centralizado: só a equipe do SEOM emite; escolas não têm acesso.

## Formato do código

```
SUZ-BR20260001-MOBI
│   │  │   │    └── sigla da classe (2 a 4 caracteres)
│   │  │   └─────── sequencial de 4 dígitos, reinicia a cada ano
│   │  └─────────── ano da emissão, 4 dígitos
│   └────────────── sigla da escola (sempre 2 caracteres)
└────────────────── prefixo fixo da URE
```

### Regras que não podem ser quebradas

1. **O sequencial é por trio (escola, classe, ano)** e reinicia em 1 todo ano.
   Isso não reaproveita código: `SUZ-BR20260001-TEC` e `SUZ-BR20270001-TEC` são
   códigos diferentes.
2. **Código nunca é reaproveitado.** Cancelar é só marcação — o número morre ocupado
   e o contador não retrocede.
3. **Código é imutável.** Não existe edição nem exclusão física.
4. **A sigla da escola é imutável a partir da primeira emissão**, mesmo que a escola
   mude de nome. O nome é campo separado e continua editável.
5. **A sigla da escola tem largura fixa: 2 caracteres.** Ela fica entre o prefixo e o
   ano, ambos de largura fixa, então o código é lido por posição — comprimento misto
   quebraria essa leitura. A sigla da classe pode variar de 2 a 4 porque fecha o
   código, depois de um separador próprio.

   Com 2 caracteres a regra automática (iniciais das duas primeiras palavras) colide:
   **7 colisões atingindo 16 escolas**. Por isso 9 siglas são desempatadas à mão e
   **não saem do nome** — estão listadas em `prisma/escolas.ts`. Sem esse desempate, a
   segunda escola de cada colisão nunca conseguiria emitir: o `codigo @unique`
   recusaria o registro para sempre.
6. **Texto livre tem teto: 200 caracteres na descrição, 100 em "Emitido por".**
   Não é capricho. Uma célula de planilha estoura em 32.767 caracteres e o SheetJS
   lança ao escrever — derrubando a exportação **inteira**, não só a linha ruim. Como
   o backup semanal depende do `.xlsx`, um único lote com texto gigante deixaria a
   base sem backup e sem explicação visível.
7. **Unidade inativa não emite**, e a trava é do servidor. A tela filtra o seletor,
   mas uma aba aberta antes da desativação ainda tem a escola na lista.
8. **Siglas são sempre maiúsculas.** Para a constraint de unicidade, `Tec` e `TEC` são valores distintos:
   aceitar caixa mista seria uma fábrica de código duplicado.
9. **Não há dígito verificador.** Decisão do cliente.
10. **O ano do código vem do relógio do servidor, no fuso de Suzano** — nunca do
    cliente e nunca de UTC. Está em `anoCorrente()` (`src/lib/config.ts`).
    `getUTCFullYear()` erraria todo 31/12 entre 21h e 24h, e `getFullYear()` erraria
    na mesma janela se o servidor rodasse em UTC, que é o padrão de container. São 3
    horas por ano, mas caem no fechamento de exercício. Código com ano errado não tem
    conserto: quando o erro aparece, a etiqueta já está no bem e o número já foi
    digitado no SEOM.

O teto é de **9.999 códigos por escola, por classe, por ano** — 4 dígitos no
sequencial. É consequência direta do formato escolhido (`SUZ-BR20260001-MOBI`); a
especificação original previa 5 dígitos, ou seja 99.999. Como o sequencial é por trio
e reinicia todo ano, 9.999 é uma escola recebendo 10 mil itens de uma só classe num
único ano. Se isso for possível em alguma unidade, o formato precisa mudar **antes da
primeira emissão** — depois é inviável.

## As duas telas

**Emissão (`/`)** — escolhe escola e classe, informa quantidade, descrição do lote e
quem está emitindo; a tela mostra o sequencial atual do trio antes de confirmar e
devolve a lista de códigos gerados. Um lote vai de **1 a 200 códigos** por emissão
(`LOTE_MAX`); a descrição precisa de ao menos 3 caracteres e “Emitido por” é
obrigatório. Se a verificação de integridade achar algo, o aviso aparece no topo
desta tela.

**Consulta (`/consulta`)** — todos os códigos já emitidos, 50 por página, com filtro
por escola, classe, período (`de`/`até`, inclusivos) e trecho do código. Código
cancelado continua listado, marcado em vermelho. O botão de exportar gera um `.xlsx`
com **os mesmos filtros da tela** — nunca a base inteira por engano — nas colunas:
Código · Escola (sigla) · Escola (nome) · CIE · Classe · Sequencial · Descrição do
lote · Emitido em · Emitido por.

Não há tela de cadastro: ver **Como mexer no cadastro**, logo abaixo.

### Nunca redigite um código — copie e cole

**Ao passar um código para o sistema do SEOM, use sempre o botão “Copiar lista” e
cole.** Não leia da tela e digite.

O motivo: há quatro pares de siglas de escola que são anagrama um do outro (`AP`/`PA`,
`AJ`/`JA`, `BR`/`RB`, `CM`/`MC`). Trocar as duas letras na digitação produz um código
**válido e existente**, que aponta para outra escola — não há dígito verificador, então
nada acusa o erro e o bem fica lançado na unidade errada.

Dentro do sistema ninguém digita sigla: ela vem do cadastro. O risco mora inteiro na
transcrição manual, e copiar e colar o elimina.

## Como mexer no cadastro

O cadastro de escolas e classes não tem tela. A fonte da verdade é
[`prisma/escolas.ts`](prisma/escolas.ts), que está versionada:

1. Edite o arquivo — nome, sigla, CIE, ou uma unidade nova.
2. `npm run db:seed` — idempotente. A chave do upsert é o **codigoCie**, não a sigla:
   o CIE é o identificador oficial e não muda, a sigla é invenção nossa e pode ser
   revisada. Chavear pela sigla faria uma revisão criar uma unidade nova em vez de
   atualizar a existente.
3. `npm run verificar` — confirma que nada quebrou.

O seed **aborta** se você tentar trocar a sigla de uma unidade que já emitiu código,
nomeando qual e quantos códigos ela tem. Sem essa trava, uma edição distraída no
arquivo passaria por cima da regra da sigla imutável pelo caminho do seed.

A vantagem de ser assim: toda alteração de cadastro fica no git, com autor e data.
Uma tela de CRUD não daria isso.

Para desativar uma unidade sem apagar histórico, use `npm run db:studio` e desmarque
`ativa` — ela some dos seletores de emissão e continua aparecendo na consulta.

**Um cuidado:** o Studio escreve direto no banco e **passa por cima da regra da sigla
imutável**. Não altere a sigla de uma unidade que já emitiu código: ele já está
impresso em campo. Se acontecer, `npm run verificar` acusa — é exatamente o caso que
aquela checagem existe para pegar.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind 4 · Prisma 7 + **Postgres (Supabase)** ·
Supabase Auth · SheetJS · Vitest. Hospedado na **Vercel**.

**Duas conexões, de propósito** (ver `src/lib/prisma.ts`):

| Variável | Porta | Usada por |
| --- | --- | --- |
| `DATABASE_URL` | 6543 (pooler, transaction mode) | uso geral em runtime |
| `DIRECT_URL` | 5432 (pooler, session mode) | migrations, seed, scripts e **a transação de emissão** |

As duas saem do mesmo host do pooler, mudando só a porta. O host `db.<ref>.supabase.co`
não serve: em projeto novo é IPv6 apenas.

**O usuário é `emissor.<ref>`, não `postgres.<ref>`.** O banco é compartilhado com
outro sistema, e rotacionar a senha do `postgres` derrubaria os dois. O papel `emissor`
tem senha própria, é dono das tabelas deste projeto, e se cria com
`npm run papel:criar`. Ele precisa de `BYPASSRLS` — ver Autenticação.

**TLS é verificado de verdade** (`verify-full`), com a CA em `SUPABASE_CA_CERT` como
conteúdo PEM. Sem ela o sistema falha em vez de degradar. Ver [INSTALL.md](INSTALL.md).

Era SQLite até a migração para a Vercel. Não é detalhe de infraestrutura: o SQLite
serializava escrita por natureza, e era isso que impedia duas emissões simultâneas de
lerem o mesmo contador. **O Postgres não faz isso.** Em `READ COMMITTED` — o padrão —
duas transações leem o mesmo `MAX(sequencial)` e as duas seguem.

O que ocupou esse lugar é um `pg_advisory_xact_lock` na chave `(escola, classe, ano)`,
tomado **antes** da leitura, dentro da mesma transação. Ele espera em vez de falhar, e
por isso o retry que existia no SQLite desapareceu: não há contenção a retentar.

## Instalação

Publicação na Vercel, criação do projeto Supabase, RLS, usuários e backup estão em
**[INSTALL.md](INSTALL.md)**. Para mexer no código localmente:

```bash
npm install               # o postinstall roda prisma generate
cp .env.example .env      # preencha as 4 variáveis
npm run db:deploy         # cria as tabelas e aplica o RLS
npm run db:seed           # carrega as 64 unidades e as 3 classes
npm run verificar         # confere a integridade
npm run rls:conferir      # confere RLS tabela por tabela
```

As quatro variáveis são obrigatórias: `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**`DIRECT_URL` precisa ser a conexão direta (5432), nunca o pooler.** Os testes se
recusam a rodar se ela apontar para 6543 — pelo pooler, o advisory lock não sobrevive à
transação e o teste de concorrência passaria sem testar nada.

O seed é idempotente (upsert pelo código CIE), então rodar de novo não duplica nada e
não toca em código já emitido.

## Uso

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm start       # sobe o build
```

A aplicação roda na máquina do SEOM, acessível só na rede local.

### Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` / `build` / `start` | ciclo normal do Next |
| `npm test` / `npm run test:watch` | Vitest contra Postgres real, um schema por arquivo |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm run db:migrate` | cria migration em desenvolvimento |
| `npm run db:deploy` | aplica migrations existentes (produção) |
| `npm run db:generate` | gera o client do Prisma (roda sozinho no `npm install`) |
| `npm run db:seed` | carrega `prisma/escolas.ts` no banco |
| `npm run rls:conferir` | lista RLS tabela por tabela, sai com 1 se algo estiver descoberto |
| `npm run papel:criar` | cria/atualiza o papel `emissor` (pede `ADMIN_URL` e `SENHA_EMISSOR`) |
| `npm run db:studio` | Prisma Studio — inspeção e correção manual |
| `npm run verificar` | verificação de integridade, sai com 1 se achar erro |
| `npm run cancelar -- <id> --por "Nome"` | cancela os códigos de um lote (pede confirmação) |

### Autenticação

**Supabase Auth, e-mail e senha.** Usuário é criado a mão no painel do Supabase, pela
equipe do SEOM: não há cadastro aberto, nem recuperação por e-mail, nem convite por
link. São poucas pessoas, todas conhecidas, e a alternativa seria uma superfície de
auto-cadastro num sistema que emite identificador de patrimônio.

Não havia login enquanto o sistema vivia na rede local. Publicado na Vercel, passou a
ser obrigatório — era o que o próprio README já dizia que aconteceria.

**“Emitido por” vem da sessão**, não de campo digitado. A tela mostra o nome, mas o
cliente nem envia o valor: a server action lê a sessão de novo no servidor. Antes era
texto livre lembrado no `localStorage`, e qualquer pessoa assinava um lote com o nome
de outra — num sistema cujo único rastro de autoria é esse campo.

**Duas camadas, de propósito.** O middleware barra navegação sem sessão; cada rota
também chama `exigirOperador()`. A segunda é a que vale: Server Action e Route Handler
são endpoints HTTP e podem ser chamados direto, sem passar por navegação.

**RLS está ativo e forçado em todas as tabelas** — e é importante saber o que isso
protege. Como não há **nenhuma** política, o padrão do Postgres é negar tudo, inclusive
para o dono. É por isso que o papel `emissor` tem `BYPASSRLS`: sem ele a aplicação não
leria as próprias tabelas. O Supabase publica uma API REST sobre o schema `public`, acessível com a chave
pública que está no navegador; sem RLS, a base inteira sairia por ali. **RLS não
restringe a aplicação**: o Prisma conecta como dono das tabelas e bypassa RLS por
definição do Postgres. A barreira do app é a sessão. Confira com `npm run rls:conferir`.

## Backup

Perder o registro de qual código já foi emitido leva direto a códigos duplicados em
campo. O procedimento completo, **incluindo como restaurar**, está em
**[INSTALL.md](INSTALL.md#parte-3--backup-e-como-restaurar)**. Em resumo:

**Toda semana:**

1. Exportar `.xlsx` pela tela de Consulta, sem filtro (a base inteira), e enviar ao
   SharePoint. É a única cópia legível sem Postgres, sem credencial e sem ferramenta.
2. `pg_dump "$DIRECT_URL" -Fc -f emissor-AAAA-MM-DD.dump`, guardado com a data no nome.

O backup automático do Supabase (Database → Backups) **depende do plano** — confira o
que existe no seu antes de contar com ele. Se não houver backup diário, o `pg_dump` não
é opcional.

**Duas pegadinhas desta arquitetura:**

- `pg_restore` traz o banco, **não traz o Authentication**. Os usuários são um backup
  separado e precisam ser recriados a mão.
- `prisma/cancelamentos.log` fica na **máquina de quem cancelou**, não no banco. Não
  entra no `pg_dump`.

## Verificação de integridade

```bash
npm run verificar
```

Procura estados que a aplicação não consegue causar sozinha, mas que um banco
restaurado errado ou uma edição feita direto no arquivo conseguem:

- **a conexão de emissão não sustenta transação interativa com advisory lock** — é o
  sintoma de `DIRECT_URL` apontando para o pooler, que quebraria a serialização do
  contador em silêncio
- sigla de escola com largura errada, ou fora do padrão maiúsculo
- sigla de classe fora da faixa de 2 a 4
- CIE ainda provisório
- **código que deixou de bater com a sigla atual da escola ou da classe** — sinal de
  que alguém alterou uma sigla por fora do sistema

Sai com código 1 se achar erro. A tela de emissão mostra os mesmos achados num aviso.

## Testes

```bash
npm test
npm run typecheck
npm run lint
```

Os testes rodam contra **Postgres real**, com as migrations de verdade aplicadas.
Nenhum usa mock do Prisma — um teste de concorrência com Prisma mockado passa sempre e
não prova nada. Cada arquivo cria seu próprio **schema** temporário (`teste_<hex>`),
derrubado no fim, e eles rodam em série (`fileParallelism: false`).

Precisam de `DIRECT_URL` no `.env`, apontando para a conexão direta. O harness
**recusa** rodar contra o pooler: sem conexão estável, o advisory lock não sobrevive à
transação e o teste de concorrência passaria sem exercitar nada.

Cobrem, entre outros: formato do código, isolamento por classe, reinício anual, não
reaproveitamento após cancelamento, concorrência, teto por ano, imutabilidade da sigla
e ordem das colunas da exportação.

### O teste que prova que o lock serve para algo

`"a emissao ESPERA pelo advisory lock do trio"` é o único **determinístico**: uma
conexão pega o lock do trio e o segura; a emissão então tem que ficar bloqueada. Se ela
terminar, não pegou o lock, e o teste quebra.

Isso existe porque a verificação foi feita de verdade — removendo o advisory lock e
rodando a suíte. O resultado foi desconfortável: **3 dos 4 testes de concorrência
passaram sem o lock.** Dois deram só 2 lotes simultâneos, e com tão pouca disputa a
corrida quase nunca cai na janela certa; o terceiro (anos diferentes) passa
corretamente, porque anos distintos são trios distintos e não disputam nada.

Os dois fracos subiram para 8 e 6 lotes, em conexões distintas — conexões importam,
porque num único `PrismaClient` o pool pode serializar as transações e **esconder** a
corrida em vez de resolvê-la. Mas teste de corrida é probabilístico por natureza; o que
garante a regressão é o teste de espera.

## Onde as regras moram

Antes de mexer, é aqui que estão as decisões:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/config.ts` | formato do código: larguras, separadores, teto, `LOTE_MAX`, regex |
| `src/lib/emissao.ts` | transação da emissão, advisory lock, cálculo do sequencial |
| `src/lib/cadastros.ts` | sigla imutável após emissão (sem tela; ver Como mexer no cadastro) |
| `src/lib/consultas.ts` | filtros compartilhados pela tela e pela exportação |
| `src/lib/exportacao.ts` | geração do `.xlsx` e ordem das colunas |
| `src/lib/boot.ts` | verificação de integridade (usada pela tela e pelo CLI) |
| `src/lib/prisma.ts` | os dois clients: pooler para uso geral, direto para a emissão |
| `prisma/escolas.ts` | as 64 unidades e as 3 classes — fonte da verdade |
| `prisma/schema.prisma` | modelo e o `@@unique` que é a rede de segurança |
| `src/test/banco.ts` | schema Postgres temporário usado pelos testes |
| `src/lib/sessao.ts` | quem está operando; `exigirOperador()` |
| `src/middleware.ts` | barra navegação sem sessão e renova o token |
| `prisma/migrations/*_rls/` | RLS ativo e forçado em todas as tabelas |

O sequencial **não** vem de tabela de contadores: é `MAX(sequencial)` lido e gravado
na mesma transação interativa. É isso que impede duas emissões simultâneas de
partirem do mesmo ponto. O `@@unique([escolaId, classeId, ano, sequencial])` existe
como segunda barreira: se a lógica falhar, o banco recusa e a transação inteira some.

## Limitações conhecidas

**Cancelar código não tem tela.** O campo `cancelado` existe, a consulta o exibe e a
emissão o respeita (o número segue ocupado), mas não há botão para marcar. O caminho é
a linha de comando:

```bash
npm run cancelar -- <id-do-lote> --por "Seu nome"
```

O script mostra o lote inteiro antes de agir, exige que você digite `CANCELAR` para
confirmar, cancela todos os códigos daquele lote de uma vez e registra a operação em
`prisma/cancelamentos.log` — que é a única memória de quem cancelou o quê, já que a
tabela não tem coluna de auditoria. O id do lote aparece na tela de Consulta.

Não há como cancelar um código isolado, nem desfazer um cancelamento pelo script. Se
cancelamento virar rotina, vira tela.

**Sem tela de cadastro.** Escolas e classes se editam por `prisma/escolas.ts` mais
`npm run db:seed`, ou pontualmente pelo `npm run db:studio`. O histórico de quem
mudou o quê fica no git do arquivo — o que o Studio faz não fica registrado.

## Notas de manutenção

**Sobre o alerta do `npm audit` no pacote `xlsx`:** as duas CVEs abertas
(`GHSA-4r6h-8v6p-xvw6`, prototype pollution, e `GHSA-5pgg-2g8v-p4x9`, ReDoS) estão no
caminho de **leitura** — as duas exigem dar parse num arquivo malicioso. Este sistema
só escreve `.xlsx`, a partir do próprio banco, e nunca abre planilha de terceiro. Por
isso a versão foi mantida. **Se um dia entrar importação de planilha, isso muda:** a
versão precisa subir antes de qualquer parse.

**Migrations:** nunca commitar migration sem atualizar `schema.prisma` no mesmo
commit. Migration com `DROP COLUMN` exige revisão manual antes de aplicar.

**Lista de escolas:** `prisma/escolas.ts` é a fonte da verdade e está versionada. O
seed sobrescreve nome e CIE a partir dela, então correção feita só pelo Prisma Studio
é desfeita no próximo seed — corrija no arquivo também.

**Configuração do Prisma:** fica em `prisma7.config.ts` (não `prisma.config.ts`); é
de lá que saem o caminho do schema, o das migrations e o comando de seed.

## Fora de escopo

Cadastro completo de bens · inventário · leitura de QR Code · movimentação entre
escolas · impressão de etiquetas · integração com Microsoft 365, SED, GDAE ou SEI ·
acesso para escolas · app mobile.

## Pendências

- [ ] **Confirmar o CIE da URE.** Está gravado como `10502`, como informado. Os 63
      CIEs de escola têm 6 caracteres com zero à esquerda (`007055`, `041956`); se o
      sistema do SEOM usar o mesmo padrão, o valor seria `010502`.
- [ ] **Confirmar que o formato inteiro é aceito** no campo de patrimônio do sistema
      que o SEOM já usa: 19 caracteres e dois `-`. Depois da primeira emissão real,
      mudar o formato é inviável.
- [ ] **Decidir sobre os 4 pares de siglas que são anagrama entre si.** São
      `AP`/`PA`, `AJ`/`JA`, `BR`/`RB` e `CM`/`MC`. Uma troca de digitação entre
      os dois gera um código **válido e existente**, apontando para a outra escola —
      nenhuma validação pega, e o bem fica lançado na unidade errada. É inerente a
      siglas de 2 caracteres, não é defeito de implementação. O teste
      `não ganha par de anagrama novo sem revisão` congela a lista atual; se ela
      mudar, a suíte quebra. Decidir antes da primeira emissão: conviver, desempatar
      um lado de cada par, ou adotar dígito verificador (hoje regra 9 diz que não há).
- [ ] **Revisar as 9 siglas desempatadas.** Nessas a sigla não sai do nome, então quem
      opera precisa consultar em vez de deduzir. Estão no topo de `prisma/escolas.ts`.
- [ ] **Antes da primeira emissão real, começar de um banco limpo.** O banco de
      desenvolvimento contém códigos de amostra emitidos como “Samuel (amostra)”.
