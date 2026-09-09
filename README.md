# Emissor de Códigos de Patrimônio — SEOM / URE Suzano

Emissor centralizado de códigos de patrimônio. Gera códigos **únicos, válidos e
rastreáveis**, que são digitados no sistema que o SEOM já usa.

Ele **não** gerencia patrimônio, não faz inventário e não substitui o sistema
existente. Uso centralizado: só a equipe do SEOM emite; escolas não têm acesso.

## Formato do código

```
BRA-202600001-MOBI
│   │   │      └── sigla da classe (2 a 4 caracteres)
│   │   └───────── sequencial de 5 dígitos, reinicia a cada ano
│   └───────────── ano da emissão, 4 dígitos
└───────────────── sigla da escola (sempre 3 caracteres)
```

### Regras que não podem ser quebradas

1. **O sequencial é por trio (escola, classe, ano)** e reinicia em 1 todo ano.
   Isso não reaproveita código: `BRA-202600001-TEC` e `BRA-202700001-TEC` são
   códigos diferentes.
2. **Código nunca é reaproveitado.** Cancelar é só marcação — o número morre ocupado
   e o contador não retrocede.
3. **Código é imutável.** Não existe edição nem exclusão física.
4. **A sigla da escola é imutável a partir da primeira emissão**, mesmo que a escola
   mude de nome. O nome é campo separado e continua editável.
5. **A sigla da escola tem largura fixa.** Ela abre o código; comprimento misto
   quebraria o parsing. A sigla da classe pode variar de 2 a 4 porque fecha o código,
   depois de um separador próprio.
6. **Siglas são sempre maiúsculas.** No SQLite, `Tec` e `TEC` são valores distintos:
   aceitar caixa mista seria uma fábrica de código duplicado.
7. **Não há dígito verificador.** Decisão do cliente.

O teto é de 99.999 códigos por escola, por classe, por ano.

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
npx prisma migrate deploy # cria o banco e aplica as migrations
npm run db:seed           # carrega as 64 unidades e as 3 classes
npm run verificar         # confere a integridade
```

## Uso

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm start       # sobe o build
```

A aplicação roda na máquina do SEOM, acessível só na rede local.

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
passa sempre e não prova nada.

Cobrem, entre outros: formato do código, isolamento por classe, reinício anual,
não reaproveitamento após cancelamento, concorrência, teto por ano, imutabilidade da
sigla e ordem das colunas da exportação.

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
seed sobrescreve nome e CIE a partir dela, então correção de cadastro feita só pela
tela é desfeita no próximo seed — corrija no arquivo também.

## Fora de escopo

Cadastro completo de bens · inventário · leitura de QR Code · movimentação entre
escolas · impressão de etiquetas · integração com Microsoft 365, SED, GDAE ou SEI ·
acesso para escolas · app mobile.

## Pendências

- [ ] **Confirmar o CIE da URE.** Está gravado como `10502`, como informado. Os 63
      CIEs de escola têm 6 caracteres com zero à esquerda (`007055`, `041956`); se o
      sistema do SEOM usar o mesmo padrão, o valor seria `010502`.
- [ ] **Confirmar que o separador `-` é aceito** no campo de patrimônio do sistema que
      o SEOM já usa. Depois da primeira emissão real, mudar o formato é inviável.
- [ ] **Antes da primeira emissão real, começar de um banco limpo.** O banco de
      desenvolvimento contém códigos de amostra emitidos como “Samuel (amostra)”.
