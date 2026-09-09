import type { Classe, Escola, PrismaClient } from "@/generated/prisma/client";
import { SIGLA_CLASSE_LENGTH, SIGLA_ESCOLA_LENGTH } from "./config";
import { getPrisma } from "./prisma";

export type CadastroErroCodigo =
  | "ESCOLA_NAO_ENCONTRADA"
  | "CLASSE_NAO_ENCONTRADA"
  | "SIGLA_IMUTAVEL"
  | "SIGLA_INVALIDA";

export class CadastroError extends Error {
  readonly codigo: CadastroErroCodigo;

  constructor(codigo: CadastroErroCodigo, message: string) {
    super(message);
    this.name = "CadastroError";
    this.codigo = codigo;
  }
}

function validarFormatoSigla(sigla: string, comprimento: number): void {
  if (sigla.length !== comprimento || !/^[A-Z0-9]+$/.test(sigla)) {
    throw new CadastroError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" precisa ter exatamente ${comprimento} caracteres ` +
        "maiusculos, sem acento e sem separador.",
    );
  }
}

/**
 * Atualiza uma escola.
 *
 * A sigla e imutavel a partir da primeira emissao, mesmo que a escola mude de nome -
 * o codigo ja impresso em campo carrega aquela sigla para sempre. O nome e campo
 * separado e continua editavel.
 *
 * A checagem vive aqui, no dominio, e nao na tela: a rota da API chama esta funcao,
 * entao bloquear na UI vira detalhe de conveniencia, nao a garantia.
 */
export async function atualizarEscola(
  input: {
    id: string;
    sigla?: string;
    codigoCie?: string;
    nome?: string;
    ativa?: boolean;
  },
  client?: PrismaClient,
): Promise<Escola> {
  const db = client ?? getPrisma();

  return db.$transaction(async (tx) => {
    const escola = await tx.escola.findUnique({ where: { id: input.id } });
    if (!escola) {
      throw new CadastroError(
        "ESCOLA_NAO_ENCONTRADA",
        `Escola ${input.id} nao encontrada.`,
      );
    }

    if (input.sigla !== undefined && input.sigla !== escola.sigla) {
      validarFormatoSigla(input.sigla, SIGLA_ESCOLA_LENGTH);

      const emitidos = await tx.codigo.count({ where: { escolaId: input.id } });
      if (emitidos > 0) {
        throw new CadastroError(
          "SIGLA_IMUTAVEL",
          `A escola ${escola.nome} ja tem ${emitidos} codigo(s) emitido(s) com a ` +
            `sigla ${escola.sigla}. A sigla nao pode mais ser alterada. Se o nome da ` +
            "escola mudou, altere apenas o nome.",
        );
      }
    }

    return tx.escola.update({
      where: { id: input.id },
      data: {
        sigla: input.sigla,
        codigoCie: input.codigoCie,
        nome: input.nome,
        ativa: input.ativa,
      },
    });
  });
}

/** Mesma regra da escola: sigla de classe congela na primeira emissao. */
export async function atualizarClasse(
  input: { id: string; sigla?: string; nome?: string; ativa?: boolean },
  client?: PrismaClient,
): Promise<Classe> {
  const db = client ?? getPrisma();

  return db.$transaction(async (tx) => {
    const classe = await tx.classe.findUnique({ where: { id: input.id } });
    if (!classe) {
      throw new CadastroError(
        "CLASSE_NAO_ENCONTRADA",
        `Classe ${input.id} nao encontrada.`,
      );
    }

    if (input.sigla !== undefined && input.sigla !== classe.sigla) {
      validarFormatoSigla(input.sigla, SIGLA_CLASSE_LENGTH);

      const emitidos = await tx.codigo.count({ where: { classeId: input.id } });
      if (emitidos > 0) {
        throw new CadastroError(
          "SIGLA_IMUTAVEL",
          `A classe ${classe.nome} ja tem ${emitidos} codigo(s) emitido(s) com a ` +
            `sigla ${classe.sigla}. A sigla nao pode mais ser alterada.`,
        );
      }
    }

    return tx.classe.update({
      where: { id: input.id },
      data: { sigla: input.sigla, nome: input.nome, ativa: input.ativa },
    });
  });
}
