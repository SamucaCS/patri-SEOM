import type { Classe, Escola, PrismaClient } from "@/generated/prisma/client";
import {
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SIGLA_ESCOLA_LENGTH,
} from "./config";
import { getPrisma } from "./prisma";

export type CadastroErroCodigo =
  | "ESCOLA_NAO_ENCONTRADA"
  | "CLASSE_NAO_ENCONTRADA"
  | "SIGLA_IMUTAVEL"
  | "SIGLA_INVALIDA"
  | "SIGLA_EM_USO"
  | "CIE_EM_USO"
  | "CAMPO_OBRIGATORIO"
  | "TEM_CODIGO_EMITIDO";

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

/* ------------------------------------------------------------------ *
 * Listagem, criação e remoção
 * ------------------------------------------------------------------ */

/**
 * Escolas com a contagem de códigos.
 *
 * `siglaTravada` é o que a tela usa para deixar o campo somente leitura. A UI é
 * conveniência: quem garante a regra é atualizarEscola(), que roda no servidor.
 */
export async function listarEscolasParaCadastro(client?: PrismaClient) {
  const db = client ?? getPrisma();
  const escolas = await db.escola.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { codigos: true } } },
  });

  return escolas.map((e) => ({
    id: e.id,
    sigla: e.sigla,
    codigoCie: e.codigoCie,
    nome: e.nome,
    ativa: e.ativa,
    codigos: e._count.codigos,
    siglaTravada: e._count.codigos > 0,
  }));
}

export async function listarClassesParaCadastro(client?: PrismaClient) {
  const db = client ?? getPrisma();
  const classes = await db.classe.findMany({
    orderBy: { sigla: "asc" },
    include: { _count: { select: { codigos: true } } },
  });

  return classes.map((c) => ({
    id: c.id,
    sigla: c.sigla,
    nome: c.nome,
    ativa: c.ativa,
    codigos: c._count.codigos,
    siglaTravada: c._count.codigos > 0,
  }));
}

function exigirTexto(valor: string, campo: string): string {
  const limpo = valor.trim();
  if (limpo.length === 0) {
    throw new CadastroError("CAMPO_OBRIGATORIO", `${campo} é obrigatório.`);
  }
  return limpo;
}

export async function criarEscola(
  input: { sigla: string; codigoCie: string; nome: string },
  client?: PrismaClient,
): Promise<Escola> {
  const db = client ?? getPrisma();

  const sigla = input.sigla.trim().toUpperCase();
  validarFormatoSigla(sigla, SIGLA_ESCOLA_LENGTH, SIGLA_ESCOLA_LENGTH);
  const codigoCie = exigirTexto(input.codigoCie, "O código CIE");
  const nome = exigirTexto(input.nome, "O nome");

  const [porSigla, porCie] = await Promise.all([
    db.escola.findUnique({ where: { sigla } }),
    db.escola.findUnique({ where: { codigoCie } }),
  ]);
  if (porSigla) {
    throw new CadastroError(
      "SIGLA_EM_USO",
      `A sigla ${sigla} já pertence a ${porSigla.nome}.`,
    );
  }
  if (porCie) {
    throw new CadastroError(
      "CIE_EM_USO",
      `O CIE ${codigoCie} já pertence a ${porCie.nome}.`,
    );
  }

  return db.escola.create({ data: { sigla, codigoCie, nome } });
}

export async function criarClasse(
  input: { sigla: string; nome: string },
  client?: PrismaClient,
): Promise<Classe> {
  const db = client ?? getPrisma();

  const sigla = input.sigla.trim().toUpperCase();
  validarFormatoSigla(sigla, SIGLA_CLASSE_MIN_LENGTH, SIGLA_CLASSE_MAX_LENGTH);
  const nome = exigirTexto(input.nome, "O nome");

  const existente = await db.classe.findUnique({ where: { sigla } });
  if (existente) {
    throw new CadastroError(
      "SIGLA_EM_USO",
      `A sigla ${sigla} já pertence a ${existente.nome}.`,
    );
  }

  return db.classe.create({ data: { sigla, nome } });
}

/**
 * Remove uma escola que nunca emitiu nada.
 *
 * Serve para desfazer cadastro errado, não para dar baixa. Escola com código emitido
 * NUNCA é apagada: o código já pode estar impresso em campo, e apagar a escola dele
 * deixaria o número órfão. Para tirar de circulação, usa-se `ativa: false`.
 */
export async function removerEscola(id: string, client?: PrismaClient): Promise<void> {
  const db = client ?? getPrisma();

  await db.$transaction(async (tx) => {
    const escola = await tx.escola.findUnique({
      where: { id },
      include: { _count: { select: { codigos: true, lotes: true } } },
    });
    if (!escola) {
      throw new CadastroError("ESCOLA_NAO_ENCONTRADA", `Escola ${id} não encontrada.`);
    }

    const usos = escola._count.codigos + escola._count.lotes;
    if (usos > 0) {
      throw new CadastroError(
        "TEM_CODIGO_EMITIDO",
        `${escola.nome} já tem ${escola._count.codigos} código(s) emitido(s) e não ` +
          "pode ser excluída. Para tirá-la de circulação, desmarque “Ativa”.",
      );
    }

    await tx.escola.delete({ where: { id } });
  });
}

/** Mesma regra da escola. */
export async function removerClasse(id: string, client?: PrismaClient): Promise<void> {
  const db = client ?? getPrisma();

  await db.$transaction(async (tx) => {
    const classe = await tx.classe.findUnique({
      where: { id },
      include: { _count: { select: { codigos: true, lotes: true } } },
    });
    if (!classe) {
      throw new CadastroError("CLASSE_NAO_ENCONTRADA", `Classe ${id} não encontrada.`);
    }

    const usos = classe._count.codigos + classe._count.lotes;
    if (usos > 0) {
      throw new CadastroError(
        "TEM_CODIGO_EMITIDO",
        `${classe.nome} já tem ${classe._count.codigos} código(s) emitido(s) e não ` +
          "pode ser excluída. Para tirá-la de circulação, desmarque “Ativa”.",
      );
    }

    await tx.classe.delete({ where: { id } });
  });
}
