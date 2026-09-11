import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  criarBancoDeTeste,
  criarClasse,
  criarEscola,
  type BancoDeTeste,
} from "@/test/banco";
import {
  ANO_DIGITS,
  CODIGO_REGEX,
  DESCRICAO_MAX_LENGTH,
  EMITIDO_POR_MAX_LENGTH,
  LOTE_MAX,
  POSICAO_ANO,
  POSICAO_SEQUENCIAL,
  SEQUENCIAL_DIGITS,
  SEQUENCIAL_MAX,
} from "./config";
import {
  EmissaoError,
  ehViolacaoDeUnicidade,
  emitirLote,
  limparTexto,
  montarCodigo,
} from "./emissao";

/** Ano fixo: os testes nao podem depender de quando forem rodados. */
const ANO = 2026;

let banco: BancoDeTeste;
let prisma: PrismaClient;
let escolaId: string;
let classeTecId: string;
let classeMobiId: string;
let classeLbId: string;

beforeEach(async () => {
  banco = await criarBancoDeTeste();
  prisma = banco.prisma;

  const escola = await criarEscola(prisma, "BR", "Batista Renzi");
  const tec = await criarClasse(prisma, "TEC", "Tecnologia");
  const mobi = await criarClasse(prisma, "MOBI", "Mobiliario");
  const lb = await criarClasse(prisma, "LB", "Linha branca");

  escolaId = escola.id;
  classeTecId = tec.id;
  classeMobiId = mobi.id;
  classeLbId = lb.id;
});

afterEach(async () => {
  await banco.destruir();
});

function entrada(overrides: Partial<Parameters<typeof emitirLote>[0]> = {}) {
  return {
    escolaId,
    classeId: classeTecId,
    quantidade: 1,
    descricao: "Lote de teste",
    emitidoPor: "Operador SEOM",
    ...overrides,
  };
}

/**
 * Extrai o sequencial de SUZ-BR20260001-TEC por posicao fixa.
 * As posicoes vem do config: o prefixo entra na conta.
 */
function sequencialDe(codigo: string): number {
  return Number(codigo.slice(POSICAO_SEQUENCIAL, POSICAO_SEQUENCIAL + SEQUENCIAL_DIGITS));
}

describe("1. formato do codigo", () => {
  it("bate com o formato SUZ-ESCOLA+ANO+SEQUENCIAL-CLASSE", async () => {
    const { codigos } = await emitirLote(entrada({ quantidade: 3 }), {
      client: prisma,
      ano: ANO,
    });

    expect(codigos).toEqual([
      "SUZ-BR20260001-TEC",
      "SUZ-BR20260002-TEC",
      "SUZ-BR20260003-TEC",
    ]);

    for (const codigo of codigos) {
      expect(codigo).toMatch(CODIGO_REGEX);
      expect(codigo).toBe(codigo.toUpperCase());
    }
  });

  it("aceita sigla de classe de 2, 3 e 4 caracteres", async () => {
    // A classe fecha o codigo, depois de um separador proprio: largura variavel
    // nao cria ambiguidade de parsing.
    const lb = await emitirLote(entrada({ classeId: classeLbId }), {
      client: prisma,
      ano: ANO,
    });
    const tec = await emitirLote(entrada({ classeId: classeTecId }), {
      client: prisma,
      ano: ANO,
    });
    const mobi = await emitirLote(entrada({ classeId: classeMobiId }), {
      client: prisma,
      ano: ANO,
    });

    expect(lb.codigos).toEqual(["SUZ-BR20260001-LB"]);
    expect(tec.codigos).toEqual(["SUZ-BR20260001-TEC"]);
    expect(mobi.codigos).toEqual(["SUZ-BR20260001-MOBI"]);

    for (const codigo of [...lb.codigos, ...tec.codigos, ...mobi.codigos]) {
      expect(codigo).toMatch(CODIGO_REGEX);
    }
  });

  it("carrega o ano da emissao e zera o sequencial a esquerda", async () => {
    const { codigos } = await emitirLote(entrada(), { client: prisma, ano: 2031 });
    expect(codigos).toEqual(["SUZ-BR20310001-TEC"]);
  });

  it("usa o ano corrente quando nenhum ano e informado", async () => {
    const { codigos } = await emitirLote(entrada(), { client: prisma });
    const anoNoCodigo = codigos[0].slice(POSICAO_ANO, POSICAO_ANO + ANO_DIGITS);

    expect(Number(anoNoCodigo)).toBe(new Date().getFullYear());
    expect(codigos[0]).toMatch(CODIGO_REGEX);
  });
});

describe("2. isolamento por classe", () => {
  it("emitir TEC nao avanca o contador de MOBI", async () => {
    await emitirLote(entrada({ quantidade: 7 }), { client: prisma, ano: ANO });

    const { codigos } = await emitirLote(
      entrada({ classeId: classeMobiId, quantidade: 2 }),
      { client: prisma, ano: ANO },
    );

    // MOBI comeca do 1 mesmo com 7 codigos TEC ja emitidos.
    expect(codigos).toEqual(["SUZ-BR20260001-MOBI", "SUZ-BR20260002-MOBI"]);

    const tecDepois = await emitirLote(entrada(), { client: prisma, ano: ANO });
    expect(tecDepois.codigos).toEqual(["SUZ-BR20260008-TEC"]);
  });

  it("escolas diferentes tem contadores independentes", async () => {
    const outra = await criarEscola(prisma, "AR", "Alfredo Roberto");

    await emitirLote(entrada({ quantidade: 4 }), { client: prisma, ano: ANO });
    const { codigos } = await emitirLote(entrada({ escolaId: outra.id }), {
      client: prisma,
      ano: ANO,
    });

    expect(codigos).toEqual(["SUZ-AR20260001-TEC"]);
  });
});

describe("2b. reinicio anual do sequencial", () => {
  it("o sequencial volta para 1 na virada do ano", async () => {
    const em2026 = await emitirLote(entrada({ quantidade: 3 }), {
      client: prisma,
      ano: 2026,
    });
    expect(em2026.codigos.map(sequencialDe)).toEqual([1, 2, 3]);

    const em2027 = await emitirLote(entrada({ quantidade: 2 }), {
      client: prisma,
      ano: 2027,
    });
    expect(em2027.codigos).toEqual(["SUZ-BR20270001-TEC", "SUZ-BR20270002-TEC"]);
  });

  it("emitir em 2027 nao mexe no contador de 2026", async () => {
    await emitirLote(entrada({ quantidade: 3 }), { client: prisma, ano: 2026 });
    await emitirLote(entrada({ quantidade: 5 }), { client: prisma, ano: 2027 });

    const voltaPara2026 = await emitirLote(entrada(), { client: prisma, ano: 2026 });
    expect(voltaPara2026.codigos).toEqual(["SUZ-BR20260004-TEC"]);
  });

  it("reiniciar o sequencial nao reaproveita codigo: o ano diferencia", async () => {
    const a = await emitirLote(entrada(), { client: prisma, ano: 2026 });
    const b = await emitirLote(entrada(), { client: prisma, ano: 2027 });

    // Mesmo sequencial 1, codigos distintos.
    expect(sequencialDe(a.codigos[0])).toBe(1);
    expect(sequencialDe(b.codigos[0])).toBe(1);
    expect(a.codigos[0]).not.toBe(b.codigos[0]);

    const total = await prisma.codigo.count();
    expect(total).toBe(2);
  });
});

describe("3. codigo nunca e reaproveitado", () => {
  it("cancelar um codigo nao devolve o sequencial para a fila", async () => {
    const primeiro = await emitirLote(entrada({ quantidade: 2 }), {
      client: prisma,
      ano: ANO,
    });
    expect(primeiro.codigos).toEqual(["SUZ-BR20260001-TEC", "SUZ-BR20260002-TEC"]);

    // Cancelamento e so marcacao: o numero morre ocupado.
    await prisma.codigo.update({
      where: { codigo: "SUZ-BR20260002-TEC" },
      data: { cancelado: true },
    });

    const segundo = await emitirLote(entrada(), { client: prisma, ano: ANO });

    expect(segundo.codigos).toEqual(["SUZ-BR20260003-TEC"]);
    expect(segundo.codigos).not.toContain("SUZ-BR20260002-TEC");
  });

  it("cancelar o ultimo codigo tambem nao faz o contador retroceder", async () => {
    await emitirLote(entrada({ quantidade: 3 }), { client: prisma, ano: ANO });
    await prisma.codigo.updateMany({
      where: { sequencial: 3 },
      data: { cancelado: true },
    });

    const depois = await emitirLote(entrada(), { client: prisma, ano: ANO });
    expect(depois.codigos).toEqual(["SUZ-BR20260004-TEC"]);
  });
});

describe("4. concorrencia (Postgres real, sem mock)", () => {
  it("emissoes simultaneas no mesmo trio geram sequenciais contiguos e sem sobreposicao", async () => {
    // LOTES era 2, e 2 nao basta: medido, a disputa quase nunca cai na janela certa e
    // o teste passava ATE COM O ADVISORY LOCK REMOVIDO. Com 8 ele quebra de forma
    // confiavel sem o lock. A garantia deterministica esta no teste
    // "a emissao ESPERA pelo advisory lock do trio".
    const LOTES = 8;
    const QUANTIDADE = 25;

    const resultados = await Promise.all(
      Array.from({ length: LOTES }, (_, i) =>
        emitirLote(entrada({ quantidade: QUANTIDADE, descricao: `Lote ${i}` }), {
          client: prisma,
          ano: ANO,
        }),
      ),
    );

    const todos = resultados.flatMap((r) => r.codigos);

    // Sem sobreposicao.
    expect(new Set(todos).size).toBe(QUANTIDADE * LOTES);

    // Contiguos: exatamente 1..200, sem buraco.
    const sequenciais = (
      await prisma.codigo.findMany({
        where: { escolaId, classeId: classeTecId, ano: ANO },
        orderBy: { sequencial: "asc" },
        select: { sequencial: true },
      })
    ).map((c) => c.sequencial);

    expect(sequenciais).toEqual(
      Array.from({ length: QUANTIDADE * LOTES }, (_, i) => i + 1),
    );

    // Cada lote recebeu um bloco contiguo proprio.
    for (const resultado of resultados) {
      const seqs = resultado.codigos.map(sequencialDe).sort((x, y) => x - y);
      expect(seqs[seqs.length - 1] - seqs[0]).toBe(QUANTIDADE - 1);
    }
  });

  it("emissoes simultaneas em conexoes distintas tambem nao se sobrepoem", async () => {
    // Eram 2 conexoes; viraram 6 pelo mesmo motivo do teste acima. Conexoes distintas
    // importam porque num unico PrismaClient as transacoes podem acabar serializadas
    // pelo pool - o que esconde a corrida em vez de resolve-la.
    const CONEXOES = 6;
    const QUANTIDADE = 20;

    const clientes = [prisma, ...Array.from({ length: CONEXOES - 1 }, () => banco.novaConexao())];

    const resultados = await Promise.all(
      clientes.map((client, i) =>
        emitirLote(entrada({ quantidade: QUANTIDADE, descricao: `Conexao ${i}` }), {
          client,
          ano: ANO,
        }),
      ),
    );

    const todos = resultados.flatMap((r) => r.codigos);
    expect(new Set(todos).size).toBe(QUANTIDADE * CONEXOES);

    const gravados = await prisma.codigo.count({
      where: { escolaId, classeId: classeTecId, ano: ANO },
    });
    expect(gravados).toBe(QUANTIDADE * CONEXOES);
  });

  it("varias emissoes simultaneas nao deixam buraco nem duplicata", async () => {
    const LOTES = 6;
    const QUANTIDADE = 10;

    const resultados = await Promise.all(
      Array.from({ length: LOTES }, (_, i) =>
        emitirLote(entrada({ quantidade: QUANTIDADE, descricao: `Lote ${i}` }), {
          client: prisma,
          ano: ANO,
        }),
      ),
    );

    const todos = resultados.flatMap((r) => r.codigos);
    expect(new Set(todos).size).toBe(LOTES * QUANTIDADE);

    const sequenciais = (
      await prisma.codigo.findMany({
        where: { escolaId, classeId: classeTecId, ano: ANO },
        orderBy: { sequencial: "asc" },
        select: { sequencial: true },
      })
    ).map((c) => c.sequencial);

    expect(sequenciais).toEqual(
      Array.from({ length: LOTES * QUANTIDADE }, (_, i) => i + 1),
    );
  });

  it("emissoes simultaneas em anos diferentes nao disputam o mesmo contador", async () => {
    const [a, b] = await Promise.all([
      emitirLote(entrada({ quantidade: 5, descricao: "2026" }), {
        client: prisma,
        ano: 2026,
      }),
      emitirLote(entrada({ quantidade: 5, descricao: "2027" }), {
        client: prisma,
        ano: 2027,
      }),
    ]);

    expect(a.codigos.map(sequencialDe)).toEqual([1, 2, 3, 4, 5]);
    expect(b.codigos.map(sequencialDe)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set([...a.codigos, ...b.codigos]).size).toBe(10);
  });
});

describe("5. teto de 99.999 por ano", () => {
  async function posicionarSequencialEm(valor: number, ano = ANO) {
    const lote = await prisma.lote.create({
      data: {
        escolaId,
        classeId: classeTecId,
        ano,
        quantidade: 1,
        descricao: "Ajuste de teste",
        emitidoPor: "teste",
      },
    });
    await prisma.codigo.create({
      data: {
        codigo: montarCodigo("BR", ano, valor, "TEC"),
        escolaId,
        classeId: classeTecId,
        ano,
        sequencial: valor,
        loteId: lote.id,
      },
    });
  }

  it("passar do teto falha com erro tratado e nao grava nada", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX);

    const antes = await prisma.codigo.count();

    await expect(
      emitirLote(entrada(), { client: prisma, ano: ANO }),
    ).rejects.toThrow(EmissaoError);

    const depois = await prisma.codigo.count();
    expect(depois).toBe(antes);
  });

  it("carrega o codigo de erro TETO_EXCEDIDO", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX);

    await expect(
      emitirLote(entrada(), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });
  });

  it("um lote que encosta exatamente no teto ainda passa", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX - 2);

    const { codigos } = await emitirLote(entrada({ quantidade: 2 }), {
      client: prisma,
      ano: ANO,
    });
    expect(codigos).toEqual(["SUZ-BR20269998-TEC", "SUZ-BR20269999-TEC"]);

    // E o proximo ja estoura.
    await expect(
      emitirLote(entrada(), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });
  });

  it("um lote que passaria do teto e recusado inteiro, sem emissao parcial", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX - 1);

    // Restam 1; pedir 5 nao pode emitir "os que couberem".
    await expect(
      emitirLote(entrada({ quantidade: 5 }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });

    const total = await prisma.codigo.count({ where: { classeId: classeTecId } });
    expect(total).toBe(1);
  });

  it("o teto e por ano: estourar 2026 nao impede emitir em 2027", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX, 2026);

    await expect(
      emitirLote(entrada(), { client: prisma, ano: 2026 }),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });

    const em2027 = await emitirLote(entrada(), { client: prisma, ano: 2027 });
    expect(em2027.codigos).toEqual(["SUZ-BR20270001-TEC"]);
  });
});

describe("unicidade nunca vira retry, e o lock e que serializa", () => {
  // O que estes testes cuidam mudou de banco, mas a garantia e a mesma: violacao de
  // unicidade e BUG DE LOGICA e tem que aparecer, nunca ser mascarada por nova
  // tentativa. No SQLite havia tambem `ehBancoOcupado`, que reconhecia
  // SQLITE_BUSY_SNAPSHOT para retentar contencao. No Postgres isso nao existe: o
  // advisory lock ESPERA em vez de falhar, entao nao ha contencao para retentar - e a
  // funcao foi removida junto com o SQLite.

  it("reconhece a violacao tipada do Prisma (P2002)", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`escolaId`,`classeId`,`ano`,`sequencial`)",
      { code: "P2002", clientVersion: "7.10.0" },
    );

    expect(ehViolacaoDeUnicidade(p2002)).toBe(true);
  });

  it("reconhece o SQLSTATE cru do Postgres (23505)", () => {
    // Forma que chega quando o erro sobe pelo driver sem o Prisma classificar.
    const cru = new Error(
      'duplicate key value violates unique constraint "Codigo_escolaId_classeId_ano_sequencial_key"',
    );
    expect(ehViolacaoDeUnicidade(cru)).toBe(true);

    const porCodigo = new Error("error: 23505: chave duplicada");
    expect(ehViolacaoDeUnicidade(porCodigo)).toBe(true);
  });

  it("acha a violacao aninhada no cause", () => {
    const aninhado = new Error("Invalid prisma.codigo.createMany() invocation", {
      cause: new Error("duplicate key value violates unique constraint"),
    });
    expect(ehViolacaoDeUnicidade(aninhado)).toBe(true);
  });

  it("erro de regra de negocio nao e confundido com violacao de unicidade", () => {
    expect(ehViolacaoDeUnicidade(new EmissaoError("TETO_EXCEDIDO", "estourou"))).toBe(
      false,
    );
    expect(ehViolacaoDeUnicidade(new Error("connection refused"))).toBe(false);
    expect(ehViolacaoDeUnicidade(undefined)).toBe(false);
  });

  it("timeout de transacao (P2028) NAO conta como unicidade", () => {
    // Transacao lenta e problema de modelagem, nao colisao de sequencial. Se isso
    // fosse tratado como unicidade, o operador veria "reporte ao suporte" por lentidao.
    const expirada = new Prisma.PrismaClientKnownRequestError(
      "Transaction API error: A query cannot be executed on an expired transaction.",
      {
        code: "P2028",
        clientVersion: "7.10.0",
        meta: { modelName: "Escola", timeout: 2000, timeTaken: 3014 },
      },
    );

    expect(ehViolacaoDeUnicidade(expirada)).toBe(false);
  });

  it("a emissao ESPERA pelo advisory lock do trio", async () => {
    // Este e o teste que detecta, de forma DETERMINISTICA, se a emissao parou de tomar
    // o advisory lock. Os testes de concorrencia acima nao servem para isso: eles
    // dependem de a disputa acontecer na janela certa, e com poucos lotes simultaneos
    // ela frequentemente nao acontece - passam mesmo com o lock removido.
    //
    // Aqui a disputa e forcada: uma conexao "guarda" pega o lock do trio e o segura.
    // Se a emissao tomar o lock, ela FICA BLOQUEADA e nao termina enquanto a guarda
    // nao soltar. Se a emissao NAO tomar o lock, ela passa reto e termina - e a
    // asserção `concluiu === false` quebra.
    const chave = `${escolaId}:${classeTecId}:${ANO}`;

    const [{ hash }] = await prisma.$queryRaw<Array<{ hash: bigint }>>`
      SELECT hashtext(${chave})::bigint AS hash
    `;

    const contarLocks = async () => {
      const r = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n FROM pg_locks
        WHERE locktype = 'advisory' AND ((classid::bigint << 32) | objid::bigint) = ${hash}
      `;
      return Number(r[0]?.n ?? 0);
    };

    let liberar!: () => void;
    const porta = new Promise<void>((r) => (liberar = r));

    const guarda = banco.novaConexao();
    const segurando = guarda.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${chave})::bigint)`;
        await porta;
      },
      { maxWait: 20_000, timeout: 90_000 },
    );

    // Espera o lock da guarda aparecer, sem depender de tempo fixo.
    for (let i = 0; i < 100 && (await contarLocks()) === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(await contarLocks()).toBeGreaterThan(0);

    // Agora a emissao, numa conexao propria para nao disputar pool com a guarda.
    let concluiu = false;
    const emissao = emitirLote(
      entrada({ quantidade: 1, descricao: "espera pelo lock" }),
      { client: banco.novaConexao(), ano: ANO },
    ).then((r) => {
      concluiu = true;
      return r;
    });

    // Folga generosa: o banco e remoto (~200ms por ida e volta). Se em 5s a emissao
    // terminou, ela nao esperou por lock nenhum.
    await new Promise((r) => setTimeout(r, 5_000));
    expect(concluiu).toBe(false);

    // Solta a guarda e observa a emissao ENQUANTO ela roda.
    //
    // Este trecho fecha um ponto cego descoberto por mutacao: trocar `tx` pelo cliente
    // global na chamada do lock faz a emissao continuar BLOQUEANDO (o lock e disputado
    // do mesmo jeito), entao a checagem de "nao concluiu" sozinha passava. So que num
    // cliente fora da transacao o `$executeRaw` roda em transacao implicita e commita
    // na hora - o lock e solto imediatamente e nao protege o MAX() seguinte.
    //
    // O que distingue: o lock precisa estar sendo segurado pelo MESMO backend que esta
    // escrevendo em Codigo. Com a mutacao, no momento da escrita nao ha lock nenhum.
    liberar();

    let viuLockJuntoDaEscrita = false;
    while (!concluiu) {
      const r = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS n
        FROM pg_locks adv
        JOIN pg_locks rel
          ON rel.pid = adv.pid
         AND rel.locktype = 'relation'
         AND rel.relation = to_regclass(${`"${banco.schema}"."Codigo"`})
        WHERE adv.locktype = 'advisory'
          AND adv.granted
          AND ((adv.classid::bigint << 32) | adv.objid::bigint) = ${hash}
      `;
      if (Number(r[0]?.n ?? 0) > 0) viuLockJuntoDaEscrita = true;
      await new Promise((r2) => setTimeout(r2, 25));
    }

    await segurando;

    const resultado = await emissao;
    expect(concluiu).toBe(true);
    expect(resultado.codigos).toEqual(["SUZ-BR20260001-TEC"]);

    // O lock esteve na MESMA conexao que escreveu - nao numa transacao solta ao lado.
    expect(viuLockJuntoDaEscrita).toBe(true);

    // `_xact_`: o lock morre no commit, sem unlock explicito.
    expect(await contarLocks()).toBe(0);
  });

  it("o indice unico recusa sequencial repetido dentro do mesmo ano", async () => {
    const lote = await prisma.lote.create({
      data: {
        escolaId,
        classeId: classeTecId,
        ano: ANO,
        quantidade: 1,
        descricao: "Semeado a mao",
        emitidoPor: "teste",
      },
    });
    await prisma.codigo.create({
      data: {
        codigo: "SUZ-BR20260001-OUTRO",
        escolaId,
        classeId: classeTecId,
        ano: ANO,
        sequencial: 1,
        loteId: lote.id,
      },
    });

    await expect(
      prisma.codigo.create({
        data: {
          codigo: "SUZ-BR20260001-TEC",
          escolaId,
          classeId: classeTecId,
          ano: ANO,
          sequencial: 1,
          loteId: lote.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("o mesmo sequencial em outro ano e aceito pelo indice unico", async () => {
    const lote = await prisma.lote.create({
      data: {
        escolaId,
        classeId: classeTecId,
        ano: 2026,
        quantidade: 1,
        descricao: "Semeado a mao",
        emitidoPor: "teste",
      },
    });
    await prisma.codigo.create({
      data: {
        codigo: "SUZ-BR20260001-TEC",
        escolaId,
        classeId: classeTecId,
        ano: 2026,
        sequencial: 1,
        loteId: lote.id,
      },
    });

    const outroAno = await prisma.codigo.create({
      data: {
        codigo: "SUZ-BR20270001-TEC",
        escolaId,
        classeId: classeTecId,
        ano: 2027,
        sequencial: 1,
        loteId: lote.id,
      },
    });

    expect(outroAno.sequencial).toBe(1);
  });
});

describe("validacao de entrada", () => {
  it("recusa quantidade fora de 1..LOTE_MAX", async () => {
    await expect(
      emitirLote(entrada({ quantidade: 0 }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "QUANTIDADE_INVALIDA" });
    await expect(
      emitirLote(entrada({ quantidade: LOTE_MAX + 1 }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "QUANTIDADE_INVALIDA" });
    await expect(
      emitirLote(entrada({ quantidade: 2.5 }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "QUANTIDADE_INVALIDA" });
  });

  it("exige descricao com pelo menos 3 caracteres", async () => {
    await expect(
      emitirLote(entrada({ descricao: "  a  " }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "DESCRICAO_INVALIDA" });
  });

  it("exige quem emitiu", async () => {
    await expect(
      emitirLote(entrada({ emitidoPor: "   " }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "EMITIDO_POR_INVALIDO" });
  });

  it("recusa ano que nao cabe em 4 digitos", async () => {
    await expect(
      emitirLote(entrada(), { client: prisma, ano: 26 }),
    ).rejects.toMatchObject({ codigo: "ANO_INVALIDO" });
    await expect(
      emitirLote(entrada(), { client: prisma, ano: 12026 }),
    ).rejects.toMatchObject({ codigo: "ANO_INVALIDO" });
  });

  it("recusa sigla de escola com comprimento fora do padrao", async () => {
    // A sigla de escola abre o codigo: comprimento misto quebraria o parsing.
    // Entra pelo banco, mas a emissao trava antes de gravar qualquer coisa.
    const torta = await prisma.escola.create({
      data: { sigla: "XYZ", nome: "Sigla de 3", codigoCie: "CIE-XYZ" },
    });

    await expect(
      emitirLote(entrada({ escolaId: torta.id }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });

  it("recusa sigla de classe minuscula, que quebraria a unicidade", async () => {
    const minuscula = await prisma.classe.create({
      data: { sigla: "Tec", nome: "Tecnologia em caixa mista" },
    });

    await expect(
      emitirLote(entrada({ classeId: minuscula.id }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });

  it("recusa sigla de classe longa demais", async () => {
    const longa = await prisma.classe.create({
      data: { sigla: "MOBILI", nome: "Sigla de 6" },
    });

    await expect(
      emitirLote(entrada({ classeId: longa.id }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });

  it("nao grava lote quando a validacao falha", async () => {
    await expect(
      emitirLote(entrada({ quantidade: 0 }), { client: prisma, ano: ANO }),
    ).rejects.toThrow();
    expect(await prisma.lote.count()).toBe(0);
    expect(await prisma.codigo.count()).toBe(0);
  });
});

describe("QA: limites de texto livre", () => {
  it("recusa descricao acima do teto", async () => {
    await expect(
      emitirLote(entrada({ descricao: "A".repeat(DESCRICAO_MAX_LENGTH + 1) }), {
        client: prisma,
        ano: ANO,
      }),
    ).rejects.toMatchObject({ codigo: "DESCRICAO_INVALIDA" });
  });

  it("aceita descricao exatamente no teto", async () => {
    const { codigos } = await emitirLote(
      entrada({ descricao: "A".repeat(DESCRICAO_MAX_LENGTH) }),
      { client: prisma, ano: ANO },
    );
    expect(codigos).toHaveLength(1);
  });

  it("recusa emitidoPor acima do teto", async () => {
    await expect(
      emitirLote(entrada({ emitidoPor: "B".repeat(EMITIDO_POR_MAX_LENGTH + 1) }), {
        client: prisma,
        ano: ANO,
      }),
    ).rejects.toMatchObject({ codigo: "EMITIDO_POR_INVALIDO" });
  });

  it("texto gigante nao chega ao banco", async () => {
    // O teto existe porque celula de planilha estoura em 32.767 caracteres e derruba
    // a exportacao inteira - e com ela o backup semanal.
    await expect(
      emitirLote(entrada({ descricao: "X".repeat(40_000) }), {
        client: prisma,
        ano: ANO,
      }),
    ).rejects.toThrow();

    expect(await prisma.lote.count()).toBe(0);
    expect(await prisma.codigo.count()).toBe(0);
  });

  it("limpa caractere de controle e colapsa espaco", () => {
    expect(limparTexto("linha1\nlinha2\ttab")).toBe("linha1 linha2 tab");
    expect(limparTexto("nulo\u0000aqui")).toBe("nulo aqui");
    expect(limparTexto("del\u007Fali")).toBe("del ali");
    expect(limparTexto("  muitos    espacos  ")).toBe("muitos espacos");
  });

  it("grava a descricao ja normalizada", async () => {
    const { codigos } = await emitirLote(
      entrada({ descricao: "cadeiras\n\tda   sala" }),
      { client: prisma, ano: ANO },
    );
    const lote = await prisma.lote.findFirstOrThrow({
      where: { codigos: { some: { codigo: codigos[0] } } },
    });

    expect(lote.descricao).toBe("cadeiras da sala");
  });
});

describe("QA: unidade inativa nao emite", () => {
  it("recusa escola inativa", async () => {
    await prisma.escola.update({ where: { id: escolaId }, data: { ativa: false } });

    await expect(
      emitirLote(entrada(), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "ESCOLA_INATIVA" });

    expect(await prisma.codigo.count()).toBe(0);
  });

  it("recusa classe inativa", async () => {
    await prisma.classe.update({ where: { id: classeTecId }, data: { ativa: false } });

    await expect(
      emitirLote(entrada(), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "CLASSE_INATIVA" });
  });

  it("a trava vive no servidor, nao no seletor da tela", async () => {
    // Cenario real: aba aberta antes da desativacao ainda tem a escola na lista.
    // O pedido chega com o escolaId antigo e precisa ser recusado aqui.
    await prisma.escola.update({ where: { id: escolaId }, data: { ativa: false } });

    await expect(
      emitirLote(entrada({ quantidade: 50 }), { client: prisma, ano: ANO }),
    ).rejects.toMatchObject({ codigo: "ESCOLA_INATIVA" });
  });

  it("reativar volta a permitir emissao", async () => {
    await prisma.escola.update({ where: { id: escolaId }, data: { ativa: false } });
    await expect(
      emitirLote(entrada(), { client: prisma, ano: ANO }),
    ).rejects.toThrow();

    await prisma.escola.update({ where: { id: escolaId }, data: { ativa: true } });
    const { codigos } = await emitirLote(entrada(), { client: prisma, ano: ANO });

    expect(codigos).toEqual(["SUZ-BR20260001-TEC"]);
  });
});
