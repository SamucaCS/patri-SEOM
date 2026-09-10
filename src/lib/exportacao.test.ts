import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  criarBancoDeTeste,
  criarClasse,
  criarEscola,
  type BancoDeTeste,
} from "@/test/banco";
import { buscarCodigos, buscarCodigosParaExportar } from "./consultas";
import { emitirLote } from "./emissao";
import { montarPlanilha, nomeArquivoExportacao } from "./exportacao";

const ANO = 2026;

let banco: BancoDeTeste;
let prisma: PrismaClient;
let escolaId: string;
let classeTecId: string;
let classeMobiId: string;

beforeEach(async () => {
  banco = await criarBancoDeTeste();
  prisma = banco.prisma;

  const escola = await criarEscola(prisma, "BR", "BATISTA RENZI");
  const tec = await criarClasse(prisma, "TEC", "Tecnologia");
  const mobi = await criarClasse(prisma, "MOBI", "Mobiliario");

  escolaId = escola.id;
  classeTecId = tec.id;
  classeMobiId = mobi.id;
});

afterEach(async () => {
  await banco.destruir();
});

async function emitir(classeId: string, quantidade: number, descricao: string) {
  return emitirLote(
    { escolaId, classeId, quantidade, descricao, emitidoPor: "Samuel" },
    { client: prisma, ano: ANO },
  );
}

/** Lê de volta a planilha que acabamos de gerar, como matriz de linhas. */
function lerPlanilha(buffer: Buffer): unknown[][] {
  const livro = XLSX.read(buffer, { type: "buffer" });
  const aba = livro.Sheets[livro.SheetNames[0]];
  return XLSX.utils.sheet_to_json(aba, { header: 1 }) as unknown[][];
}

describe("exportacao .xlsx", () => {
  it("usa exatamente a ordem de colunas da especificacao", async () => {
    await emitir(classeTecId, 2, "Notebooks");

    const codigos = await buscarCodigosParaExportar({}, prisma);
    const linhas = lerPlanilha(montarPlanilha(codigos));

    expect(linhas[0]).toEqual([
      "Código",
      "Escola (sigla)",
      "Escola (nome)",
      "CIE",
      "Classe",
      "Sequencial",
      "Descrição do lote",
      "Emitido em",
      "Emitido por",
    ]);
  });

  it("leva os dados do codigo, da escola e do lote para a linha", async () => {
    const { codigos: emitidos } = await emitir(classeTecId, 1, "Notebooks da sala 3");

    const codigos = await buscarCodigosParaExportar({}, prisma);
    const linhas = lerPlanilha(montarPlanilha(codigos));
    const linha = linhas[1];

    expect(linha[0]).toBe(emitidos[0]);
    expect(linha[1]).toBe("BR");
    expect(linha[2]).toBe("BATISTA RENZI");
    expect(linha[4]).toBe("TEC");
    expect(linha[5]).toBe(1);
    expect(linha[6]).toBe("Notebooks da sala 3");
    expect(linha[8]).toBe("Samuel");
  });

  it("exporta uma linha por codigo, mais o cabecalho", async () => {
    await emitir(classeTecId, 7, "Lote grande");

    const codigos = await buscarCodigosParaExportar({}, prisma);
    const linhas = lerPlanilha(montarPlanilha(codigos));

    expect(linhas).toHaveLength(8);
  });

  it("nome do arquivo carrega carimbo de data e extensao correta", () => {
    const nome = nomeArquivoExportacao(new Date("2026-09-09T13:45:10Z"));
    expect(nome).toBe("codigos-patrimonio-2026-09-09-13-45-10.xlsx");
  });

  it("planilha vazia ainda traz o cabecalho", async () => {
    const linhas = lerPlanilha(montarPlanilha([]));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toHaveLength(9);
  });
});

describe("filtros da consulta", () => {
  it("filtra por classe", async () => {
    await emitir(classeTecId, 3, "Tecnologia");
    await emitir(classeMobiId, 2, "Mobiliario");

    const so = await buscarCodigos({ classeId: classeMobiId }, 1, prisma);
    expect(so.total).toBe(2);
    expect(so.itens.every((c) => c.classe.sigla === "MOBI")).toBe(true);
  });

  it("filtra por trecho do codigo, ignorando a caixa digitada", async () => {
    await emitir(classeTecId, 2, "Tecnologia");
    await emitir(classeMobiId, 2, "Mobiliario");

    const maiuscula = await buscarCodigos({ codigo: "MOBI" }, 1, prisma);
    const minuscula = await buscarCodigos({ codigo: "mobi" }, 1, prisma);

    expect(maiuscula.total).toBe(2);
    expect(minuscula.total).toBe(2);
  });

  it("a exportacao enxerga o mesmo conjunto que a tabela", async () => {
    await emitir(classeTecId, 3, "Tecnologia");
    await emitir(classeMobiId, 4, "Mobiliario");

    const filtros = { classeId: classeMobiId };
    const tabela = await buscarCodigos(filtros, 1, prisma);
    const exportados = await buscarCodigosParaExportar(filtros, prisma);

    // O .xlsx nao pode divergir do que o operador viu na tela.
    expect(exportados).toHaveLength(tabela.total);
    expect(exportados.map((c) => c.codigo).sort()).toEqual(
      tabela.itens.map((c) => c.codigo).sort(),
    );
  });

  it("pagina no servidor sem repetir nem perder codigo", async () => {
    // 120 codigos com TAMANHO_PAGINA de 50: tres paginas.
    await emitir(classeTecId, 120, "Lote longo");

    const p1 = await buscarCodigos({}, 1, prisma);
    const p2 = await buscarCodigos({}, 2, prisma);
    const p3 = await buscarCodigos({}, 3, prisma);

    expect(p1.paginas).toBe(3);
    expect(p1.itens).toHaveLength(50);
    expect(p2.itens).toHaveLength(50);
    expect(p3.itens).toHaveLength(20);

    const todos = [...p1.itens, ...p2.itens, ...p3.itens].map((c) => c.codigo);
    expect(new Set(todos).size).toBe(120);
  });

  it("pagina invalida cai na primeira, sem quebrar", async () => {
    await emitir(classeTecId, 5, "Lote");

    const zero = await buscarCodigos({}, 0, prisma);
    const negativa = await buscarCodigos({}, -3, prisma);

    expect(zero.pagina).toBe(1);
    expect(negativa.pagina).toBe(1);
  });

  it("codigo cancelado continua aparecendo na consulta", async () => {
    const { codigos } = await emitir(classeTecId, 2, "Lote");
    await prisma.codigo.update({
      where: { codigo: codigos[0] },
      data: { cancelado: true },
    });

    // Nao existe DELETE fisico: o cancelado tem que continuar auditavel.
    const resultado = await buscarCodigos({}, 1, prisma);
    expect(resultado.total).toBe(2);
    expect(resultado.itens.some((c) => c.cancelado)).toBe(true);
  });
});

describe("QA: a exportacao nao pode quebrar por causa de uma linha", () => {
  /** Grava um lote direto, sem passar pela emissao, simulando dado herdado. */
  async function loteCru(descricao: string, emitidoPor = "QA") {
    const lote = await prisma.lote.create({
      data: {
        escolaId,
        classeId: classeTecId,
        ano: ANO,
        quantidade: 1,
        descricao,
        emitidoPor,
      },
    });
    await prisma.codigo.create({
      data: {
        codigo: `SUZ-BR${ANO}9999-TEC`,
        escolaId,
        classeId: classeTecId,
        ano: ANO,
        sequencial: 9999,
        loteId: lote.id,
      },
    });
  }

  it("texto acima do limite de uma celula nao derruba a planilha", async () => {
    // A emissao barra isso na entrada, mas dado herdado ou editado a mao pelo
    // Prisma Studio chegaria aqui. Antes da correcao, UMA linha assim fazia o
    // SheetJS lancar e a exportacao INTEIRA falhava - levando junto o backup semanal.
    await emitir(classeMobiId, 2, "Lote normal");
    await loteCru("Z".repeat(40_000));

    const codigos = await buscarCodigosParaExportar({}, prisma);
    expect(codigos).toHaveLength(3);

    const linhas = lerPlanilha(montarPlanilha(codigos));
    expect(linhas).toHaveLength(4);
  });

  it("o valor cortado fica visivel, nao silencioso", async () => {
    await loteCru("Z".repeat(40_000));

    const linhas = lerPlanilha(montarPlanilha(await buscarCodigosParaExportar({}, prisma)));
    const descricao = String(linhas[1][6]);

    expect(descricao.length).toBeLessThanOrEqual(32_767);
    expect(descricao).toContain("[CORTADO]");
  });

  it("emitidoPor gigante tambem nao derruba", async () => {
    await loteCru("Descricao normal", "Y".repeat(50_000));

    expect(() =>
      montarPlanilha([] as never[]),
    ).not.toThrow();

    const linhas = lerPlanilha(montarPlanilha(await buscarCodigosParaExportar({}, prisma)));
    expect(String(linhas[1][8])).toContain("[CORTADO]");
  });

  it("nome de escola gigante tambem e cortado", async () => {
    await prisma.escola.update({
      where: { id: escolaId },
      data: { nome: "N".repeat(40_000) },
    });
    await emitir(classeTecId, 1, "Lote");

    const linhas = lerPlanilha(montarPlanilha(await buscarCodigosParaExportar({}, prisma)));
    expect(String(linhas[1][2])).toContain("[CORTADO]");
  });
});
