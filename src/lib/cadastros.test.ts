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

let banco: BancoDeTeste;
let prisma: PrismaClient;
let escolaId: string;
let classeId: string;

beforeEach(async () => {
  banco = criarBancoDeTeste();
  prisma = banco.prisma;

  const escola = await criarEscola(prisma, "BR", "Batista Renzi");
  const classe = await criarClasse(prisma, "TEC", "Tecnologia e informatica");
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
    prisma,
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
      atualizarClasse({ id: classeId, sigla: "TIC" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_IMUTAVEL" });
  });

  it("recusa sigla nova com comprimento errado mesmo sem codigo emitido", async () => {
    await expect(
      atualizarEscola({ id: escolaId, sigla: "ABC" }, prisma),
    ).rejects.toMatchObject({ codigo: "SIGLA_INVALIDA" });
  });
});
