import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  criarBancoDeTeste,
  criarClasse,
  criarEscola,
  type BancoDeTeste,
} from "@/test/banco";
import { verificarIntegridade } from "./boot";
import { emitirLote } from "./emissao";

let banco: BancoDeTeste;
let prisma: PrismaClient;

beforeEach(() => {
  banco = criarBancoDeTeste();
  prisma = banco.prisma;
});

afterEach(async () => {
  await banco.destruir();
});

const erros = (ps: Awaited<ReturnType<typeof verificarIntegridade>>) =>
  ps.filter((p) => p.nivel === "erro");

describe("verificacao de integridade", () => {
  it("nao acusa nada num banco saudavel", async () => {
    const escola = await criarEscola(prisma, "BR", "BATISTA RENZI");
    const classe = await criarClasse(prisma, "TEC", "Tecnologia");
    await emitirLote(
      {
        escolaId: escola.id,
        classeId: classe.id,
        quantidade: 3,
        descricao: "Lote",
        emitidoPor: "teste",
      },
      { client: prisma, ano: 2026 },
    );

    expect(await verificarIntegridade(prisma)).toEqual([]);
  });

  it("acusa sigla de escola com largura errada", async () => {
    await prisma.escola.create({
      data: { sigla: "XYZ", nome: "Sigla longa", codigoCie: "111111" },
    });

    const problemas = erros(await verificarIntegridade(prisma));
    expect(problemas).toHaveLength(1);
    expect(problemas[0].mensagem).toContain("XYZ");
  });

  it("acusa sigla de classe fora da faixa", async () => {
    await prisma.classe.create({ data: { sigla: "MOBILI", nome: "Longa demais" } });

    const problemas = erros(await verificarIntegridade(prisma));
    expect(problemas).toHaveLength(1);
    expect(problemas[0].mensagem).toContain("MOBILI");
  });

  it("avisa sobre CIE provisorio sem tratar como erro", async () => {
    await prisma.escola.create({
      data: { sigla: "PE", nome: "Sem CIE", codigoCie: "PENDENTE-PE" },
    });

    const problemas = await verificarIntegridade(prisma);
    expect(erros(problemas)).toHaveLength(0);
    expect(problemas.some((p) => p.nivel === "aviso")).toBe(true);
  });

  it("pega codigo que deixou de bater com a sigla da escola", async () => {
    const escola = await criarEscola(prisma, "BR", "BATISTA RENZI");
    const classe = await criarClasse(prisma, "TEC", "Tecnologia");
    await emitirLote(
      {
        escolaId: escola.id,
        classeId: classe.id,
        quantidade: 2,
        descricao: "Lote",
        emitidoPor: "teste",
      },
      { client: prisma, ano: 2026 },
    );

    // Simula alteracao de sigla por fora do sistema - a API bloqueia isso, o
    // banco aberto na mao nao.
    await prisma.escola.update({ where: { id: escola.id }, data: { sigla: "ZZ" } });

    const problemas = erros(await verificarIntegridade(prisma));
    expect(problemas).toHaveLength(1);
    expect(problemas[0].mensagem).toContain("SUZ-BR20260001-TEC");
  });

  it("pega codigo que deixou de bater com a sigla da classe", async () => {
    const escola = await criarEscola(prisma, "BR", "BATISTA RENZI");
    const classe = await criarClasse(prisma, "TEC", "Tecnologia");
    await emitirLote(
      {
        escolaId: escola.id,
        classeId: classe.id,
        quantidade: 1,
        descricao: "Lote",
        emitidoPor: "teste",
      },
      { client: prisma, ano: 2026 },
    );

    await prisma.classe.update({ where: { id: classe.id }, data: { sigla: "MOBI" } });

    const problemas = erros(await verificarIntegridade(prisma));
    expect(problemas).toHaveLength(1);
    expect(problemas[0].mensagem).toContain("não batem mais");
  });
});
