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
6. **Siglas são sempre maiúsculas.** No SQLite, `Tec` e `TEC` são valores distintos:
   aceitar caixa mista seria uma fábrica de código duplicado.
7. **Não há dígito verificador.** Decisão do cliente.

O teto é de 9.999 códigos por escola, por classe, por ano.

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

Next.js 15 · React 19 · TypeScript · Tailwind 4 · Prisma 7 + SQLite · Zod · SheetJS ·
Vitest.

O banco é um arquivo local (`prisma/emissor.db`). Não há serviço externo nem conta em
lugar nenhum.

O SQLite é adequado aqui porque o volume é de alguns lotes por semana e porque ele
serializa escritas por natureza — duas emissões simultâneas não conseguem gravar ao
mesmo tempo, o que elimina a classe de bug mais perigosa deste sistema.

## Instalação

```bash
npm install
cp .env.example .env      # confira o caminho do banco
npx prisma generate       # gera o client em src/generated/prisma
npx prisma migrate deploy # cria o banco e aplica as migrations
npm run db:seed           # carrega as 64 unidades e as 3 classes
npm run verificar         # confere a integridade
```

O `prisma generate` não é opcional em clone novo: `src/generated/prisma` não vai para
o git, e sem ele o build e o typecheck falham por módulo inexistente.

O seed é idempotente (upsert pela sigla), então rodar de novo não duplica nada e não
toca em código já emitido.

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
| `npm test` / `npm run test:watch` | Vitest contra SQLite real |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm run db:migrate` | cria migration em desenvolvimento |
| `npm run db:deploy` | aplica migrations existentes (produção) |
| `npm run db:seed` | carrega `prisma/escolas.ts` no banco |
| `npm run db:studio` | Prisma Studio — inspeção e correção manual |
| `npm run verificar` | verificação de integridade, sai com 1 se achar erro |

### Sem autenticação — e por quê

Não há login no MVP. O campo **“Emitido por”** é preenchido pelo operador e serve de
rastro de auditoria, não de segurança. Nessa escala e nessa rede, resolve.

**Se a aplicação for exposta fora da rede local, isso muda e autenticação passa a ser
obrigatória.** Não é uma decisão para adiar nesse cenário.

## Backup

O banco inteiro é um arquivo. Sem a rotina abaixo, o sistema depende de uma máquina
só — e perder esse arquivo significa perder o registro de qual código já foi emitido,
o que leva direto a códigos duplicados em campo.

**Toda semana:**

1. Exportar `.xlsx` pela tela de Consulta, sem filtro (a base inteira), e enviar ao
   SharePoint. Serve também de espelho de consulta para quem não tem acesso à máquina.
2. Copiar o arquivo do banco junto:

   ```
   prisma/emissor.db
   prisma/emissor.db-wal
   prisma/emissor.db-shm
   ```

   Copie os três, e com a aplicação parada. O `-wal` guarda escritas que ainda não
   foram para o arquivo principal: copiar só o `.db` com o servidor no ar pode
   capturar um estado incompleto.

**Para restaurar:** pare a aplicação, coloque os três arquivos de volta em `prisma/`,
e rode `npm run verificar` antes de emitir qualquer coisa.

## Verificação de integridade

```bash
npm run verificar
```

Procura estados que a aplicação não consegue causar sozinha, mas que um banco
restaurado errado ou uma edição feita direto no arquivo conseguem:

- `journal_mode` diferente de WAL
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

Os testes rodam contra **SQLite real em disco**, com as migrations de verdade
aplicadas. Nenhum usa mock do Prisma — um teste de concorrência com Prisma mockado
passa sempre e não prova nada. Cada arquivo abre seu próprio banco temporário e eles
rodam em série (`fileParallelism: false`).

Cobrem, entre outros: formato do código, isolamento por classe, reinício anual,
não reaproveitamento após cancelamento, concorrência, teto por ano, imutabilidade da
sigla e ordem das colunas da exportação.

## Onde as regras moram

Antes de mexer, é aqui que estão as decisões:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/config.ts` | formato do código: larguras, separadores, teto, `LOTE_MAX`, regex |
| `src/lib/emissao.ts` | transação da emissão, cálculo do sequencial, retry em contenção |
| `src/lib/cadastros.ts` | sigla imutável após emissão (sem tela; ver Como mexer no cadastro) |
| `src/lib/consultas.ts` | filtros compartilhados pela tela e pela exportação |
| `src/lib/exportacao.ts` | geração do `.xlsx` e ordem das colunas |
| `src/lib/boot.ts` | verificação de integridade (usada pela tela e pelo CLI) |
| `src/lib/prisma.ts` | client, WAL, `busy_timeout` |
| `prisma/escolas.ts` | as 64 unidades e as 3 classes — fonte da verdade |
| `prisma/schema.prisma` | modelo e o `@@unique` que é a rede de segurança |
| `src/test/banco.ts` | banco SQLite real usado pelos testes |

O sequencial **não** vem de tabela de contadores: é `MAX(sequencial)` lido e gravado
na mesma transação interativa. É isso que impede duas emissões simultâneas de
partirem do mesmo ponto. O `@@unique([escolaId, classeId, ano, sequencial])` existe
como segunda barreira: se a lógica falhar, o banco recusa e a transação inteira some.

## Limitações conhecidas

**Cancelar código não tem tela.** O campo `cancelado` existe, a consulta o exibe e a
emissão o respeita (o número segue ocupado), mas não há botão para marcar. Hoje isso
se faz por `npm run db:studio`, com a aplicação parada. Se cancelamento virar rotina,
vira tela — não fica no Studio.

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
- [ ] **Revisar as 9 siglas desempatadas.** Nessas a sigla não sai do nome, então quem
      opera precisa consultar em vez de deduzir. Estão no topo de `prisma/escolas.ts`.
- [ ] **Antes da primeira emissão real, começar de um banco limpo.** O banco de
      desenvolvimento contém códigos de amostra emitidos como “Samuel (amostra)”.
