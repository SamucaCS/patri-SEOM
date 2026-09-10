# Emissor de Códigos de Patrimônio — SEOM / URE Suzano

Documento de decisões. Registra **o que foi pedido e por quê** — o README cobre como o
sistema se comporta.

Última atualização: setembro de 2026, após as etapas 0 a 5 e a rodada de QA.

> Este arquivo foi reconstruído a partir do histórico do projeto, não do código.
> Ao retomar, confira cada regra contra a implementação e corrija divergências aqui.

---

## Contexto

O SEOM controla o patrimônio das escolas da rede. Antes deste sistema, o número de
patrimônio era decidido caso a caso, sem garantia de unicidade e sem registro de quem
emitiu.

Este sistema é um **emissor centralizado de códigos**. Não gerencia patrimônio, não faz
inventário, não substitui o sistema que o SEOM já usa. Gera códigos únicos e
rastreáveis, que são digitados no sistema existente.

Uso centralizado: apenas a equipe do SEOM emite. Volume esperado: alguns lotes por
semana.

**Não existe número de patrimônio oficial do Estado confiável nesses bens.** Por isso
este código é o identificador de fato — o que eleva o padrão de unicidade e
imutabilidade.

---

## Formato

```
SUZ-BR20260001-MOBI
```

| Bloco | Largura | Conteúdo |
|-------|---------|----------|
| `SUZ` | 3 | Prefixo fixo da unidade regional |
| `-` | 1 | Separador |
| `BR` | 2 | Sigla da escola |
| `2026` | 4 | Ano de emissão |
| `0001` | 4 | Sequencial |
| `-` | 1 | Separador |
| `MOBI` | 2 a 4 | Sigla da classe |

Total: 17 a 19 caracteres.

O bloco central é concatenado sem separador, então a leitura depende de larguras fixas
de 2, 4 e 4. **Sigla de escola com comprimento diferente quebra o parsing.**

### Regras invioláveis

1. **Sigla de escola: exatamente 2 caracteres**, igual para todas. Validado na emissão
   e no boot.
2. **Sequencial é por trio (escola, classe, ano)** e reinicia em janeiro.
   Garantido por `@@unique([escolaId, classeId, ano, sequencial])`.
3. **Teto de 9.999** por trio. Consequência dos 4 dígitos.
4. **O ano vem do relógio do servidor**, resolvido em `America/Sao_Paulo` via `Intl`
   (`anoCorrente()`), nunca de `getFullYear()` cru. A server action não aceita ano do
   cliente. `emitirLote` tem um parâmetro `ano` opcional, usado **só pelos testes**
   para fixar o ano — se algum dia ele for exposto numa rota, esta regra cai.
5. **Código nunca é reaproveitado.** `MAX()` sem filtrar cancelados. Lote errado se
   marca como cancelado por `npm run cancelar`; o número segue ocupado. Não há tela,
   não há como cancelar código isolado, e o script não desfaz cancelamento.
6. **Código é imutável.** Nenhuma rota edita ou apaga código.
7. **Sigla é imutável após a primeira emissão** daquela escola ou classe. O nome
   continua editável.

   Onde isso é de fato aplicado hoje: em `prisma/seed.ts`, que aborta com `exit 1`
   nomeando a unidade e a contagem de códigos. `src/lib/cadastros.ts` também aplica a
   regra, para escola e classe, e está sob teste — mas **nada na aplicação importa esse
   módulo** desde que a tela de cadastros saiu. É rede pronta para uma tela futura, não
   defesa em vigor. O Prisma Studio passa por cima de tudo isso.
8. **Não há dígito verificador.** Ver "Decisões em aberto".

---

## Histórico do formato

Três versões. Registrado para que ninguém reabra discussão já encerrada.

| Versão | Formato | Por que mudou |
|--------|---------|---------------|
| 1 | `BR00001TEC` | Proposta inicial do cliente, 10 caracteres |
| 2 | `BRA-202600001-MOBI` | Sigla de 2 letras deu 7 colisões atingindo 16 escolas; entrou o ano |
| 3 | `SUZ-BR20260001-MOBI` | Decisão do cliente |

**Antes de qualquer nova mudança de formato**, confirme o limite do campo no sistema do
SEOM. Depois da primeira emissão real, mudar formato é inviável.

---

## Decisões tomadas e o porquê

**Aleatório foi descartado.** Cinco dígitos aleatórios colidem com probabilidade
altíssima em algumas centenas de itens, e evitar isso exigiria consultar um banco
central — que é justamente o que torna o sequencial trivial. Sequencial ainda entrega
auditoria: buraco na sequência é sinal de investigação.

**Classe fica no fim do código.** Trade-off aceito: o código não agrupa por categoria na
ordenação, mas fica legível da esquerda para a direita. Como a classe é o último bloco,
ela pode ter largura variável sem quebrar o parsing.

**SQLite, não Postgres.** Volume baixo, zero dependência de conta em serviço externo, e
o SQLite serializa escritas por natureza. A aplicação roda na rede local do SEOM.

**Sem autenticação.** `Emitido por` é rastro de auditoria, não segurança. Vale enquanto
a aplicação só existir na rede local. Exposta para fora, isso deixa de bastar.

**Sem Zod.** Estava na especificação original, foi instalado e nunca usado. As
validações à mão funcionam e estão sob teste. A linha da especificação estava errada,
não o código.

**Tela de cadastros removida.** Escola e classe novas passam pelo Samuel. Ver
"Dependências humanas".

**Injeção de fórmula no `.xlsx` não é tratada.** Verificado no XML gerado: as células
de texto saem como `t="str"` e o arquivo **não tem nenhuma tag `<f>`** — não há fórmula
para o Excel avaliar, `<v>` é valor em cache e nunca é interpretado. (Não é `t="s"`: o
SheetJS não gera `sharedStrings.xml` aqui. Quem for auditar procurando `t="s"` acha
zero e conclui errado.) Isso é problema de CSV. **Se um dia entrar exportação em CSV,
essa decisão precisa ser revista.**

**Retry casa com o `originalCode` do SQLite, nunca com `P1008`.** Contenção real chega
como `SQLITE_BUSY_SNAPSHOT` — caso do modo WAL em que o snapshot de leitura ficou
obsoleto e o SQLite recusa na hora, ignorando `busy_timeout` de propósito. `P1008` puro
seria largo demais e engoliria transação lenta. Retry sobre violação de unicidade
(`P2002`) é **proibido**: ali é bug de lógica e mascarar esconderia o problema.

**Teto de tamanho em texto livre.** Célula de planilha estoura em 32.767 caracteres e o
SheetJS lança ao escrever. Sem teto, um único lote com texto grande derrubaria a
exportação de toda a base — e com ela o backup semanal, silenciosamente. Teto na entrada
e corte defensivo na exportação.

---

## Fora de escopo

Nada disso foi feito, por decisão:

- Cadastro completo de bens (valor, nota fiscal, foto)
- Inventário, conferência, leitura de QR Code
- Movimentação entre escolas, transferência, baixa
- Impressão ou geração de etiquetas
- Integração com Microsoft 365, SharePoint, SED, GDAE ou SEI
- Acesso para escolas
- App mobile ou PWA
- Autenticação

Se algo acima parecer necessário, pare e pergunte.

---

## Risco conhecido e não resolvido: siglas de 2 caracteres

Com 2 caracteres, a lista tem 4 pares de anagrama, 233 pares que diferem por um único
caractere, e 15 siglas com caractere visualmente ambíguo (O/0, I/1, S/5).

Digitar o anagrama trocado produz um código válido e existente, apontando para outra
escola. Nenhuma validação pega, porque não há dígito verificador.

Um teste congela os 4 pares conhecidos. Escola nova que crie um par quebra a suíte e
força uma decisão consciente.

**A mitigação em vigor é procedimental: nunca redigitar um código, sempre usar
"Copiar lista" e colar.** Está registrado no README, em "Nunca redigite um código" — é
o que reduz o risco a praticamente zero, já que dentro do app ninguém digita sigla.

`LB` escola × `LB` classe **não** é colisão: as posições são fixas e separadas por
hífen, e `SUZ-LB20260001-LB` é um código perfeitamente válido. O teste
`registra a colisão conhecida entre sigla de escola e sigla de classe` apenas congela
o par — o nome dele exagera, não indica defeito.

---

## Dependências humanas

Estas não são técnicas e são as que matam sistema de órgão público:

1. **Escola ou classe nova passa pelo Samuel.** Não há tela de cadastro. Documentar no
   README a quem recorrer e como pedir.
2. **A aplicação roda numa máquina só.** Precisa subir sozinha após reboot e ter
   endereço fixo na rede.
3. **Backup precisa ter sido restaurado ao menos uma vez, por outra pessoa**, seguindo
   o README. Backup nunca testado não é backup.
4. **Alguém do SEOM treinado** no que fazer quando não abrir e onde está o backup — não
   em usar a tela.

---

## Decisões em aberto

**Limite do campo no sistema do SEOM.** Bloqueia a primeira emissão real. Confirmar
quantos caracteres o campo aceita, se aceita hífen e se aceita comprimento variável,
com alguém digitando e salvando um registro de teste. Se precisar encurtar, o primeiro
corte é o prefixo `SUZ`, que é constante e não distingue nada.

**Dígito verificador.** Descartado quando o código tinha 10 caracteres e sigla de 3
letras. As premissas mudaram: 19 caracteres, sigla de 2, e este código é o único
identificador do bem. Decidir uma vez e encerrar.

**CIE da URE: `10502` ou `010502`?** Os 63 CIEs de escola têm 6 caracteres com zero à
esquerda. O campo é texto de propósito — dois CIEs terminam em letra (`007171A`,
`921518A`) e tratá-los como número truncaria.

**`BEGIN IMMEDIATE` na transação de emissão.** Faria a transação nascer como escritora e
eliminaria o `SQLITE_BUSY_SNAPSHOT` em vez de retentá-lo. Opcional no volume atual.

---

## Antes de virar produção

1. Formato confirmado no sistema do SEOM, com teste de digitação presencial
2. Aplicação instalada na máquina do SEOM, sobrevivendo a reboot
3. Restauração de backup testada por outra pessoa
4. Piloto com uma escola, ponta a ponta, até os números entrarem no sistema do SEOM
5. README revisado por quem não conhece o sistema

**Histórico relevante:** nunca commitar migration sem atualizar `schema.prisma` no mesmo
commit. Migration com `DROP COLUMN` exige revisão manual.
