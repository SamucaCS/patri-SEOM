"use server";

import { revalidatePath } from "next/cache";
import {
  CadastroError,
  atualizarClasse,
  atualizarEscola,
  criarClasse,
  criarEscola,
  removerClasse,
  removerEscola,
} from "@/lib/cadastros";

export type ResultadoCadastro = { ok: true } | { ok: false; mensagem: string };

/**
 * Fronteira das telas de cadastro.
 *
 * Toda regra - inclusive a imutabilidade da sigla - vive em lib/cadastros.ts e roda
 * aqui, no servidor. A tela desabilitar o campo é conveniência: mesmo um cliente
 * adulterado esbarra nesta camada.
 */
async function executar(acao: () => Promise<unknown>): Promise<ResultadoCadastro> {
  try {
    await acao();
    revalidatePath("/cadastros");
    revalidatePath("/");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof CadastroError) {
      return { ok: false, mensagem: erro.message };
    }
    console.error("[cadastros] Falha inesperada.", erro);
    return {
      ok: false,
      mensagem: "Não foi possível salvar. Verifique o log do servidor.",
    };
  }
}

export async function criarEscolaAction(input: {
  sigla: string;
  codigoCie: string;
  nome: string;
}): Promise<ResultadoCadastro> {
  return executar(() => criarEscola(input));
}

export async function atualizarEscolaAction(input: {
  id: string;
  sigla?: string;
  codigoCie?: string;
  nome?: string;
  ativa?: boolean;
}): Promise<ResultadoCadastro> {
  return executar(() => atualizarEscola(input));
}

export async function removerEscolaAction(id: string): Promise<ResultadoCadastro> {
  return executar(() => removerEscola(id));
}

export async function criarClasseAction(input: {
  sigla: string;
  nome: string;
}): Promise<ResultadoCadastro> {
  return executar(() => criarClasse(input));
}

export async function atualizarClasseAction(input: {
  id: string;
  sigla?: string;
  nome?: string;
  ativa?: boolean;
}): Promise<ResultadoCadastro> {
  return executar(() => atualizarClasse(input));
}

export async function removerClasseAction(id: string): Promise<ResultadoCadastro> {
  return executar(() => removerClasse(id));
}
