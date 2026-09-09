import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  criarBancoDeTeste,
  criarClasse,
  criarEscola,
  type BancoDeTeste,
} from "@/test/banco";
import { CadastroError, atualizarClasse, atualizarEscola } from "./cadastros";
import { emitirLote } from "./emissao";

const ANO = 2026;

let banco: BancoDeTeste;
let prisma: PrismaClient;
let escolaId: string;
let classeId: string;

beforeEach(async () => {
  banco = criarBancoDeTeste();
  prisma = banco.prisma;

  const escola = await criarEscola(prisma, "BR", "Batista Renzi");
  const classe = await criarClasse(prisma, "TEC", "Tecnologia");
  escolaId = escola.id;
  classeId = classe.id;
});

afterEach(async () => {
  await banco.destruir();
});

async function emitirUm() {
  return emitirLote(
    {
      escolaId,
      classeId,
      quantidade: 1,
      descricao: "Primeiro lote",
      emitidoPor: "Operador SEOM",
    },
    { client: prisma, ano: ANO },
  );
}

describe("6. imutabilidade da sigla", () => {
  it("recusa alterar a sigla de escola que ja tem codigo emitido", async () => {
    await emitirUm();

    await expect(
      atualizarEscola({ id: escolaId, sigla: "XY" }, prisma),
    ).rejects.toBeInstanceOf(CadastroError);

    await expect(
      atualizarEscola({ id: escolaId, sigla: "XY" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_IMUTAVEL" });

    // A sigla no banco continua a original.
    const escola = await prisma.escola.findUniqueOrThrow({ where: { id: escolaId } });
    expect(escola.sigla).toBe("BR");
  });

  it("permite trocar a sigla enquanto nenhum codigo foi emitido", async () => {
    const atualizada = await atualizarEscola({ id: escolaId, sigla: "BZ" }, prisma);
    expect(atualizada.sigla).toBe("BZ");
  });

  it("continua permitindo editar o nome depois da primeira emissao", async () => {
    await emitirUm();

    const atualizada = await atualizarEscola(
      { id: escolaId, nome: "EE Batista Renzi (nome novo)" },
      prisma,
    );

    expect(atualizada.nome).toBe("EE Batista Renzi (nome novo)");
    expect(atualizada.sigla).toBe("BR");
  });

  it("reenviar a mesma sigla nao e tratado como alteracao", async () => {
    await emitirUm();

    const atualizada = await atualizarEscola(
      { id: escolaId, sigla: "BR", nome: "Batista Renzi" },
      prisma,
    );
    expect(atualizada.sigla).toBe("BR");
  });

  it("vale tambem para sigla de classe", async () => {
    await emitirUm();

    await expect(
      atualizarClasse({ id: classeId, sigla: "TECN" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_IMUTAVEL" });
  });
});

describe("formato da sigla no cadastro", () => {
  it("escola exige largura fixa: 3 caracteres e recusado", async () => {
    await expect(
      atualizarEscola({ id: escolaId, sigla: "ABC" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });

  it("classe aceita de 2 a 4 caracteres", async () => {
    const lb = await atualizarClasse({ id: classeId, sigla: "LB" }, prisma);
    expect(lb.sigla).toBe("LB");

    const mobi = await atualizarClasse({ id: classeId, sigla: "MOBI" }, prisma);
    expect(mobi.sigla).toBe("MOBI");
  });

  it("classe recusa sigla de 1 e de 5 caracteres", async () => {
    await expect(
      atualizarClasse({ id: classeId, sigla: "M" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });

    await expect(
      atualizarClasse({ id: classeId, sigla: "MOBIL" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });

  it("recusa sigla minuscula: no SQLite 'Tec' e 'TEC' seriam registros distintos", async () => {
    await expect(
      atualizarClasse({ id: classeId, sigla: "Tec" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });
});
