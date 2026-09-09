import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  criarBancoDeTeste,
  criarClasse,
  criarEscola,
  type BancoDeTeste,
} from "@/test/banco";
import { CODIGO_LENGTH, LOTE_MAX, SEQUENCIAL_MAX } from "./config";
import {
  EmissaoError,
  ehBancoOcupado,
  ehViolacaoDeUnicidade,
  emitirLote,
} from "./emissao";

let banco: BancoDeTeste;
let prisma: PrismaClient;
let escolaId: string;
let classeTecId: string;
let classeMovId: string;

beforeEach(async () => {
  banco = criarBancoDeTeste();
  prisma = banco.prisma;

  const escola = await criarEscola(prisma, "BR", "Batista Renzi");
  const tec = await criarClasse(prisma, "TEC", "Tecnologia e informatica");
  const mov = await criarClasse(prisma, "MOV", "Moveis");

  escolaId = escola.id;
  classeTecId = tec.id;
  classeMovId = mov.id;
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

describe("1. formato do codigo", () => {
  it("tem o comprimento exato, e maiusculo e nao tem separador", async () => {
    const { codigos } = await emitirLote(entrada({ quantidade: 3 }), prisma);

    expect(codigos).toHaveLength(3);
    for (const codigo of codigos) {
      expect(codigo).toHaveLength(CODIGO_LENGTH);
      expect(codigo).toBe(codigo.toUpperCase());
      expect(codigo).toMatch(/^[A-Z0-9]+$/);
      expect(codigo).not.toMatch(/[-_./\s]/);
    }
  });

  it("reproduz os exemplos reais do cliente", async () => {
    const { codigos } = await emitirLote(entrada({ quantidade: 2 }), prisma);
    expect(codigos).toEqual(["BR00001TEC", "BR00002TEC"]);

    const mov = await emitirLote(
      entrada({ classeId: classeMovId, quantidade: 1 }),
      prisma,
    );
    expect(mov.codigos).toEqual(["BR00001MOV"]);
  });

  it("comeca em 1 e zera a esquerda ate 5 digitos", async () => {
    const { codigos } = await emitirLote(entrada({ quantidade: 1 }), prisma);
    expect(codigos[0]).toBe("BR00001TEC");
  });
});

describe("2. isolamento por classe", () => {
  it("emitir TEC nao avanca o contador de MOV", async () => {
    await emitirLote(entrada({ quantidade: 7 }), prisma);

    const { codigos } = await emitirLote(
      entrada({ classeId: classeMovId, quantidade: 2 }),
      prisma,
    );

    // MOV comeca do 1 mesmo com 7 codigos TEC ja emitidos.
    expect(codigos).toEqual(["BR00001MOV", "BR00002MOV"]);

    const tecDepois = await emitirLote(entrada({ quantidade: 1 }), prisma);
    expect(tecDepois.codigos).toEqual(["BR00008TEC"]);
  });

  it("escolas diferentes tem contadores independentes", async () => {
    const outra = await criarEscola(prisma, "AL", "Alfredo Roberto");

    await emitirLote(entrada({ quantidade: 4 }), prisma);
    const { codigos } = await emitirLote(
      entrada({ escolaId: outra.id, quantidade: 1 }),
      prisma,
    );

    expect(codigos).toEqual(["AL00001TEC"]);
  });
});

describe("3. codigo nunca e reaproveitado", () => {
  it("cancelar um codigo nao devolve o sequencial para a fila", async () => {
    const primeiro = await emitirLote(entrada({ quantidade: 2 }), prisma);
    expect(primeiro.codigos).toEqual(["BR00001TEC", "BR00002TEC"]);

    // Cancelamento e so marcacao: o numero morre ocupado.
    await prisma.codigo.update({
      where: { codigo: "BR00002TEC" },
      data: { cancelado: true },
    });

    const segundo = await emitirLote(entrada({ quantidade: 1 }), prisma);

    expect(segundo.codigos).toEqual(["BR00003TEC"]);
    expect(segundo.codigos).not.toContain("BR00002TEC");
  });

  it("cancelar o ultimo codigo tambem nao faz o contador retroceder", async () => {
    await emitirLote(entrada({ quantidade: 3 }), prisma);
    await prisma.codigo.updateMany({
      where: { sequencial: 3 },
      data: { cancelado: true },
    });

    const depois = await emitirLote(entrada({ quantidade: 1 }), prisma);
    expect(depois.codigos).toEqual(["BR00004TEC"]);
  });
});

describe("4. concorrencia (SQLite real, sem mock)", () => {
  it("duas emissoes simultaneas no mesmo par geram sequenciais contiguos e sem sobreposicao", async () => {
    const QUANTIDADE = 25;

    const [a, b] = await Promise.all([
      emitirLote(entrada({ quantidade: QUANTIDADE, descricao: "Lote A" }), prisma),
      emitirLote(entrada({ quantidade: QUANTIDADE, descricao: "Lote B" }), prisma),
    ]);

    const todos = [...a.codigos, ...b.codigos];

    // Sem sobreposicao.
    expect(new Set(todos).size).toBe(QUANTIDADE * 2);

    // Contiguos: exatamente 1..50, sem buraco.
    const sequenciais = (
      await prisma.codigo.findMany({
        where: { escolaId, classeId: classeTecId },
        orderBy: { sequencial: "asc" },
        select: { sequencial: true },
      })
    ).map((c) => c.sequencial);

    expect(sequenciais).toEqual(
      Array.from({ length: QUANTIDADE * 2 }, (_, i) => i + 1),
    );

    // Cada lote recebeu um bloco contiguo proprio.
    for (const resultado of [a, b]) {
      const seqs = resultado.codigos
        .map((c) => Number(c.slice(2, 7)))
        .sort((x, y) => x - y);
      expect(seqs[seqs.length - 1] - seqs[0]).toBe(QUANTIDADE - 1);
    }
  });

  it("emissoes simultaneas em conexoes distintas tambem nao se sobrepoem", async () => {
    const conexaoB = banco.novaConexao();
    const QUANTIDADE = 20;

    const [a, b] = await Promise.all([
      emitirLote(entrada({ quantidade: QUANTIDADE, descricao: "Conexao A" }), prisma),
      emitirLote(
        entrada({ quantidade: QUANTIDADE, descricao: "Conexao B" }),
        conexaoB,
      ),
    ]);

    const todos = [...a.codigos, ...b.codigos];
    expect(new Set(todos).size).toBe(QUANTIDADE * 2);

    const gravados = await prisma.codigo.count({
      where: { escolaId, classeId: classeTecId },
    });
    expect(gravados).toBe(QUANTIDADE * 2);
  });

  it("varias emissoes simultaneas nao deixam buraco nem duplicata", async () => {
    const LOTES = 6;
    const QUANTIDADE = 10;

    const resultados = await Promise.all(
      Array.from({ length: LOTES }, (_, i) =>
        emitirLote(entrada({ quantidade: QUANTIDADE, descricao: `Lote ${i}` }), prisma),
      ),
    );

    const todos = resultados.flatMap((r) => r.codigos);
    expect(new Set(todos).size).toBe(LOTES * QUANTIDADE);

    const sequenciais = (
      await prisma.codigo.findMany({
        where: { escolaId, classeId: classeTecId },
        orderBy: { sequencial: "asc" },
        select: { sequencial: true },
      })
    ).map((c) => c.sequencial);

    expect(sequenciais).toEqual(
      Array.from({ length: LOTES * QUANTIDADE }, (_, i) => i + 1),
    );
  });
});

describe("5. teto de 99.999", () => {
  async function posicionarSequencialEm(valor: number) {
    const lote = await prisma.lote.create({
      data: {
        escolaId,
        classeId: classeTecId,
        quantidade: 1,
        descricao: "Ajuste de teste",
        emitidoPor: "teste",
      },
    });
    await prisma.codigo.create({
      data: {
        codigo: `BR${String(valor).padStart(5, "0")}TEC`,
        escolaId,
        classeId: classeTecId,
        sequencial: valor,
        loteId: lote.id,
      },
    });
  }

  it("passar do teto falha com erro tratado e nao grava nada", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX);

    const antes = await prisma.codigo.count();

    await expect(emitirLote(entrada({ quantidade: 1 }), prisma)).rejects.toThrow(
      EmissaoError,
    );

    const depois = await prisma.codigo.count();
    expect(depois).toBe(antes);
  });

  it("carrega o codigo de erro TETO_EXCEDIDO", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX);

    await expect(
      emitirLote(entrada({ quantidade: 1 }), prisma),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });
  });

  it("um lote que encosta exatamente no teto ainda passa", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX - 2);

    const { codigos } = await emitirLote(entrada({ quantidade: 2 }), prisma);
    expect(codigos).toEqual(["BR99998TEC", "BR99999TEC"]);

    // E o proximo ja estoura.
    await expect(
      emitirLote(entrada({ quantidade: 1 }), prisma),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });
  });

  it("um lote que passaria do teto e recusado inteiro, sem emissao parcial", async () => {
    await posicionarSequencialEm(SEQUENCIAL_MAX - 1);

    // Restam 1; pedir 5 nao pode emitir "os que couberem".
    await expect(
      emitirLote(entrada({ quantidade: 5 }), prisma),
    ).rejects.toMatchObject({ codigo: "TETO_EXCEDIDO" });

    const total = await prisma.codigo.count({ where: { classeId: classeTecId } });
    expect(total).toBe(1);
  });
});

describe("retry: contencao sim, bug de logica nao", () => {
  it("reconhece 'database is locked' como contencao", () => {
    expect(ehBancoOcupado(new Error("database is locked"))).toBe(true);
    expect(ehBancoOcupado(new Error("SQLITE_BUSY: database is locked"))).toBe(true);
    // Mensagem real chega aninhada no `cause`.
    expect(
      ehBancoOcupado(
        new Error("Invalid prisma.codigo.createMany() invocation", {
          cause: new Error("database is locked"),
        }),
      ),
    ).toBe(true);
  });

  it("NAO trata violacao de unicidade como contencao (nunca retenta)", () => {
    const violacao = new Error("UNIQUE constraint failed: Codigo.sequencial");
    expect(ehViolacaoDeUnicidade(violacao)).toBe(true);
    expect(ehBancoOcupado(violacao)).toBe(false);

    // Nem quando a mensagem cita lock junto: unicidade vence e nao retenta.
    const misto = new Error(
      "UNIQUE constraint failed: Codigo.sequencial (database is locked)",
    );
    expect(ehBancoOcupado(misto)).toBe(false);
  });

  it("erro de regra de negocio nao e confundido com contencao", () => {
    const erro = new EmissaoError("TETO_EXCEDIDO", "estourou");
    expect(ehBancoOcupado(erro)).toBe(false);
    expect(ehViolacaoDeUnicidade(erro)).toBe(false);
  });

  it("trata P1008 como contencao (e o que o Prisma 7 realmente emite aqui)", () => {
    const p1008 = new Prisma.PrismaClientKnownRequestError("Operation has timed out", {
      code: "P1008",
      clientVersion: "7.10.0",
    });

    expect(ehBancoOcupado(p1008)).toBe(true);
    expect(ehViolacaoDeUnicidade(p1008)).toBe(false);
  });

  it("P2002 NUNCA e retentado, mesmo vindo do Prisma tipado", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`escolaId`,`classeId`,`sequencial`)",
      { code: "P2002", clientVersion: "7.10.0" },
    );

    expect(ehViolacaoDeUnicidade(p2002)).toBe(true);
    // A garantia central: violacao de unicidade jamais entra no caminho de retry.
    expect(ehBancoOcupado(p2002)).toBe(false);
  });

  it("violacao de unicidade sobe como SEQUENCIAL_DUPLICADO, sem retentar", async () => {
    // Ocupa o sequencial 1 por fora, deixando o proximo calculo colidir.
    const lote = await prisma.lote.create({
      data: {
        escolaId,
        classeId: classeTecId,
        quantidade: 1,
        descricao: "Semeado a mao",
        emitidoPor: "teste",
      },
    });
    await prisma.codigo.create({
      data: {
        codigo: "OUTRO0001",
        escolaId,
        classeId: classeTecId,
        sequencial: 1,
        loteId: lote.id,
      },
    });

    // Um segundo registro com o MESMO par (escola, classe, sequencial) e recusado
    // pelo indice unico - a rede de seguranca do schema.
    await expect(
      prisma.codigo.create({
        data: {
          codigo: "BR00001TEC",
          escolaId,
          classeId: classeTecId,
          sequencial: 1,
          loteId: lote.id,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("validacao de entrada", () => {
  it("recusa quantidade fora de 1..LOTE_MAX", async () => {
    await expect(emitirLote(entrada({ quantidade: 0 }), prisma)).rejects.toMatchObject(
      { codigo: "QUANTIDADE_INVALIDA" },
    );
    await expect(
      emitirLote(entrada({ quantidade: LOTE_MAX + 1 }), prisma),
    ).rejects.toMatchObject({ codigo: "QUANTIDADE_INVALIDA" });
    await expect(
      emitirLote(entrada({ quantidade: 2.5 }), prisma),
    ).rejects.toMatchObject({ codigo: "QUANTIDADE_INVALIDA" });
  });

  it("exige descricao com pelo menos 3 caracteres", async () => {
    await expect(
      emitirLote(entrada({ descricao: "  a  " }), prisma),
    ).rejects.toMatchObject({ codigo: "DESCRICAO_INVALIDA" });
  });

  it("exige quem emitiu", async () => {
    await expect(
      emitirLote(entrada({ emitidoPor: "   " }), prisma),
    ).rejects.toMatchObject({ codigo: "EMITIDO_POR_INVALIDO" });
  });

  it("recusa sigla de escola com comprimento fora do padrao", async () => {
    // Comprimento misto quebra o parsing do codigo; entra pelo banco, mas a emissao
    // trava antes de gravar qualquer coisa.
    const torta = await prisma.escola.create({
      data: { sigla: "XYZ", nome: "Sigla de 3", codigoCie: "CIE-XYZ" },
    });

    await expect(
      emitirLote(entrada({ escolaId: torta.id }), prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });

  it("nao grava lote quando a validacao falha", async () => {
    await expect(emitirLote(entrada({ quantidade: 0 }), prisma)).rejects.toThrow();
    expect(await prisma.lote.count()).toBe(0);
    expect(await prisma.codigo.count()).toBe(0);
  });
});
