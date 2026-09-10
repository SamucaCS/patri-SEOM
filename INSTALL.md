# Instalação na máquina do SEOM

Guia para instalar o emissor numa máquina que **não tem nada**: sem Node, sem Git, sem
conta no GitHub. Nada aqui exige conta em serviço nenhum.

O sistema roda **nessa máquina só**, e as outras acessam pelo navegador, pela rede
local. Não vai para nuvem — o porquê está no README, em "Sem autenticação".

---

## Antes de começar, responda uma pergunta

**A máquina do setor tem internet?**

- **Tem** → Caminho A. Você carrega 1,1 MB, ou nem isso: baixa direto lá.
- **Não tem** → Caminho B. Você carrega ~950 MB num pen drive, e há uma exigência
  extra sobre a versão do Node.

Não precisa de conta no GitHub em nenhum dos dois. O repositório é público: o ZIP baixa
pelo navegador, sem login.

---

## O que a máquina precisa ter

| Item | Versão | Por quê |
|------|--------|---------|
| Windows | x64 | é o que foi testado |
| Node.js | **24.x** | o pacote `better-sqlite3` é binário nativo, casado com a versão do Node |
| Espaço livre | ~1,5 GB | `node_modules` sozinho tem 806 MB |

**A versão do Node não é detalhe.** O banco é acessado por um binário compilado
(`better_sqlite3.node`) que só funciona na ABI do Node para o qual foi instalado. Node
22 ou 26 dá erro de ABI, com mensagem confusa que não menciona a versão.

---

## Caminho A — máquina com internet

### 1. Instalar o Node.js

Baixe o instalador **LTS** em <https://nodejs.org> (arquivo `.msi`) e instale com as
opções padrão. Depois abra o **Prompt de Comando** e confirme:

```
node -v
```

Precisa responder `v24.` seguido de algo. Se responder outra coisa, desinstale e
instale a 24.

### 2. Baixar o projeto

No navegador da máquina, abra:

<https://github.com/SamucaCS/patri-SEOM/archive/refs/heads/main.zip>

Extraia numa pasta definitiva — **não** em Downloads nem na Área de Trabalho, porque o
banco de dados vai morar dentro dela. Sugestão:

```
C:\emissor-seom
```

A pasta extraída vem com nome `patri-SEOM-main`. Renomeie para `emissor-seom`, ou
ajuste os caminhos daqui pra frente.

### 3. Criar o arquivo `.env`

Na raiz da pasta, crie um arquivo chamado exatamente `.env` (com o ponto, e sem `.txt`
no fim) contendo esta única linha:

```
DATABASE_URL="file:./prisma/emissor.db"
```

**Este é o passo que mais se esquece.** Sem ele nada sobe, e o erro diz apenas
"DATABASE_URL nao definida". Há um modelo em `.env.example`: copiar e renomear resolve.

### 4. Instalar as dependências

Abra o Prompt de Comando **na pasta do projeto** e rode:

```
npm install
```

Demora alguns minutos e baixa cerca de 800 MB. É a única etapa que precisa de internet.

Ao terminar, ele roda `prisma generate` sozinho — é o que cria a pasta
`src/generated/prisma`, que **não vem no download** porque é gerada, não escrita à mão.
Se algum comando adiante reclamar de `Cannot find module '../src/generated/prisma/client'`,
rode:

```
npm run db:generate
```

### 5. Criar o banco e carregar as escolas

```
npm run db:deploy
npm run db:seed
```

O primeiro cria as tabelas. O segundo carrega as **64 unidades** (a URE mais 63
escolas) e as **3 classes**. Confira:

```
npm run verificar
```

Precisa responder:

```
Banco: 64 escolas, 3 classes, 0 códigos.
Nenhum problema encontrado.
```

**Se o número de códigos não for 0**, este banco não está limpo. Pare e avise: emitir a
partir de um banco com códigos de teste embaralha o sequencial, e código emitido nunca
é reaproveitado.

### 6. Gerar a versão de produção e subir

```
npm run build
npm start
```

O `build` demora um ou dois minutos, e só precisa rodar de novo quando o código mudar.
O `start` é o que fica no ar. Ele imprime dois endereços:

```
- Local:   http://localhost:3000
- Network: http://10.x.x.x:3000
```

O segundo é o que as outras máquinas do setor usam. **Anote.**

Enquanto essa janela do Prompt estiver aberta, o sistema está no ar; fechar a janela
derruba. O passo "Subir sozinha depois do reboot", abaixo, resolve isso.

---

## Caminho B — máquina sem internet

Aqui você leva tudo pronto. Só funciona se as duas máquinas tiverem **o mesmo sistema e
a mesma versão maior do Node** — de novo, por causa do binário nativo.

### 1. Na máquina que tem internet

Confirme plataforma e versão:

```
node -v
node -e "console.log(process.platform, process.arch)"
```

Anote as duas respostas. Faça o Caminho A inteiro, até o passo 6, e confirme que o
sistema abre no navegador.

### 2. Copie para o pen drive

A pasta **inteira**, incluindo `node_modules` e `.next` — é justamente o que dispensa a
internet do outro lado. Cerca de 950 MB.

Copie junto o instalador `.msi` do Node.js, na mesma versão.

**Não copie o `prisma/emissor.db`** se você emitiu qualquer código de teste. Melhor
levar sem banco e rodar `db:deploy` e `db:seed` do outro lado — os dois funcionam
offline.

### 3. Na máquina do setor

1. Instale o Node pelo `.msi` do pen drive.
2. Confirme que `node -v` responde a **mesma versão maior** anotada no passo 1.
3. Copie a pasta do pen drive para `C:\emissor-seom`.
4. Confirme que o `.env` veio junto: arquivo que começa com ponto às vezes não copia.
5. Rode `npm run db:deploy`, `npm run db:seed` e `npm run verificar`.
6. Rode `npm start`.

Não rode `npm install` aqui: sem internet ele falha e pode deixar o `node_modules` pela
metade. Se precisar reinstalar, volte para a máquina com internet.

**Se aparecer erro citando `NODE_MODULE_VERSION` ou `better_sqlite3.node`**, é a versão
do Node diferente. Não há contorno local: instale a versão certa.

---

## Depois de instalar

Instalar não é entregar. Faltam quatro coisas, e são elas que fazem o sistema sobreviver
ao dia a dia.

### Subir sozinha depois do reboot

Sem isso, todo desligamento derruba o sistema e alguém precisa saber reabrir o Prompt.

Crie um arquivo `iniciar.cmd` na pasta do projeto:

```
@echo off
cd /d C:\emissor-seom
npm start
```

Depois, no **Agendador de Tarefas** do Windows:

1. Criar Tarefa — não "Tarefa Básica".
2. Aba **Geral**: marque *Executar estando o usuário conectado ou não* e *Executar com
   privilégios mais altos*.
3. Aba **Disparadores**: novo, *Ao iniciar o computador*.
4. Aba **Ações**: iniciar programa → `C:\emissor-seom\iniciar.cmd`.
5. Aba **Configurações**: **desmarque** *Parar a tarefa se for executada por mais de...*
   — senão o Windows derruba o servidor depois de três dias.

Teste reiniciando a máquina e abrindo o endereço de outra máquina, **sem fazer login**
na máquina do servidor.

### Endereço fixo na rede

O `http://10.x.x.x:3000` muda se o IP vier por DHCP. Peça à TI um **IP fixo** ou uma
**reserva de DHCP** para essa máquina. Sem isso o endereço muda sozinho e o sistema
"para de funcionar" sem ninguém ter mexido em nada.

### Liberar a porta no firewall

Se as outras máquinas não abrirem o endereço, é o Firewall do Windows. Libere a porta
`3000` para **entrada**, com escopo de rede local apenas.

### Backup semanal

Está no README, na seção **Backup**, e precisa de destino definido — o SharePoint do
setor. São duas partes: exportar o `.xlsx` da tela de Consulta e copiar os arquivos do
banco com a aplicação parada.

**Restaure o backup uma vez, em outra pasta, por outra pessoa, antes de considerar isso
pronto.** Backup nunca restaurado não é backup.

---

## Quando não abrir

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| "DATABASE_URL nao definida" | falta o `.env` | crie o `.env` do passo 3 |
| "Cannot find module '../src/generated/prisma/client'" | o client do Prisma não foi gerado | `npm run db:generate` |
| erro citando `NODE_MODULE_VERSION` | versão errada do Node | instale a 24.x |
| abre em `localhost` mas não nas outras máquinas | firewall, ou o IP mudou | libere a porta 3000; confira o IP |
| a tela mostra aviso no topo | integridade do banco | rode `npm run verificar` e leia a mensagem |
| não abre depois de um reboot | a tarefa agendada não subiu | abra o Agendador e veja o histórico da tarefa |

O comando que responde a maior parte das dúvidas:

```
npm run verificar
```

Ele diz quantas escolas, classes e códigos existem, e sai com erro se achar problema.
Rode depois de restaurar backup, e sempre que o banco tiver sido tocado por fora.

---

## O que NÃO fazer nessa máquina

- **Não** abra o `prisma/emissor.db` em editor, nem copie por cima com o sistema no ar.
- **Não** conte com o `npm run db:seed` para corrigir sigla de escola que já emitiu
  código: ele aborta de propósito. Sigla é imutável depois da primeira emissão.
- **Não** exponha essa máquina para fora da rede do setor. Não há autenticação: qualquer
  um com o endereço emite código, e código emitido nunca é reaproveitado.
