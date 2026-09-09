import type { Classe, Escola, PrismaClient } from "@/generated/prisma/client";
import {
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SIGLA_ESCOLA_LENGTH,
} from "./config";
import { getPrisma } from "./prisma";

/**
 * Regras de cadastro de escola e classe.
 *
 * Nao existe tela de cadastro: o cadastro se faz editando prisma/escolas.ts e rodando
 * `npm run db:seed`, que e idempotente e sobrescreve nome e CIE. Correcao pontual sai
 * pelo `npm run db:studio`.
 *
 * Estas funcoes continuam aqui porque sao onde a imutabilidade da sigla e aplicada de
 * fato. Elas seguem cobertas por teste e prontas caso um caminho de edicao volte.
 *
 * O Prisma Studio passa por cima delas - escreve direto no banco. A rede para esse
 * caso e `verificarIntegridade()` em boot.ts, que compara cada codigo ja gravado com
 * a sigla ATUAL da escola e da classe e acusa quando alguem mexeu por fora.
 */
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

/**
 * Sigla de escola: largura fixa, porque abre o codigo.
 * Sigla de classe: 2 a 4, porque fecha o codigo depois de um separador proprio.
 */
function validarFormatoSigla(sigla: string, minimo: number, maximo: number): void {
  if (sigla.length < minimo || sigla.length > maximo) {
    const exigencia =
      minimo === maximo
        ? `exatamente ${minimo} caracteres`
        : `de ${minimo} a ${maximo} caracteres`;
    throw new CadastroError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" precisa ter ${exigencia}.`,
    );
  }
  if (!/^[A-Z0-9]+$/.test(sigla)) {
    throw new CadastroError(
      "SIGLA_INVALIDA",
      `A sigla "${sigla}" precisa ser maiuscula, sem acento e sem separador. ` +
        'Minuscula quebraria a unicidade: no SQLite, "Tec" e "TEC" sao distintos.',
    );
  }
}

/**
 * Atualiza uma escola.
 *
 * A sigla e imutavel a partir da primeira emissao, mesmo que a escola mude de nome -
 * o codigo ja impresso em campo carrega aquela sigla para sempre. O nome e campo
 * separado e continua editavel.
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
      validarFormatoSigla(input.sigla, SIGLA_ESCOLA_LENGTH, SIGLA_ESCOLA_LENGTH);

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
      validarFormatoSigla(input.sigla, SIGLA_CLASSE_MIN_LENGTH, SIGLA_CLASSE_MAX_LENGTH);

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
