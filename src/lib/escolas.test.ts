import { describe, expect, it } from "vitest";
import { CLASSES, ESCOLAS } from "../../prisma/escolas";
import {
  CODIGO_REGEX,
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SIGLA_ESCOLA_LENGTH,
} from "./config";
import { montarCodigo } from "./emissao";

/**
 * A sigla e imutavel depois da primeira emissao. Estes testes existem para que uma
 * edicao distraida na lista - uma escola nova, uma sigla trocada - falhe aqui e nao
 * em producao, depois de codigos ja impressos em campo.
 */
describe("lista oficial de escolas", () => {
  it("nao tem sigla repetida", () => {
    const siglas = ESCOLAS.map((e) => e.sigla);
    const repetidas = siglas.filter((s, i) => siglas.indexOf(s) !== i);

    expect(repetidas).toEqual([]);
    expect(new Set(siglas).size).toBe(ESCOLAS.length);
  });

  it("toda sigla tem exatamente SIGLA_ESCOLA_LENGTH caracteres", () => {
    // Comprimento misto na sigla de escola quebraria o parsing: ela abre o codigo.
    const fora = ESCOLAS.filter((e) => e.sigla.length !== SIGLA_ESCOLA_LENGTH);
    expect(fora).toEqual([]);
  });

  it("toda sigla e maiuscula, sem acento e sem separador", () => {
    const fora = ESCOLAS.filter((e) => !/^[A-Z0-9]+$/.test(e.sigla));
    expect(fora).toEqual([]);
  });

  it("nao tem nome repetido", () => {
    const nomes = ESCOLAS.map((e) => e.nome);
    expect(new Set(nomes).size).toBe(ESCOLAS.length);
  });

  it("cobre as 64 entradas da URE Suzano", () => {
    expect(ESCOLAS).toHaveLength(64);
  });
});

describe("lista oficial de classes", () => {
  it("nao tem sigla repetida", () => {
    const siglas = CLASSES.map((c) => c.sigla);
    expect(new Set(siglas).size).toBe(CLASSES.length);
  });

  it("toda sigla cabe na faixa permitida e e maiuscula", () => {
    for (const classe of CLASSES) {
      expect(classe.sigla.length).toBeGreaterThanOrEqual(SIGLA_CLASSE_MIN_LENGTH);
      expect(classe.sigla.length).toBeLessThanOrEqual(SIGLA_CLASSE_MAX_LENGTH);
      expect(classe.sigla).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it("sao as tres definidas pelo SEOM", () => {
    expect(CLASSES.map((c) => c.sigla)).toEqual(["LB", "MOBI", "TEC"]);
  });
});

describe("todo par escola x classe gera codigo valido", () => {
  it("bate com CODIGO_REGEX nas 192 combinacoes", () => {
    const invalidos: string[] = [];

    for (const escola of ESCOLAS) {
      for (const classe of CLASSES) {
        for (const sequencial of [1, 42, 99999]) {
          const codigo = montarCodigo(escola.sigla, 2026, sequencial, classe.sigla);
          if (!CODIGO_REGEX.test(codigo)) invalidos.push(codigo);
        }
      }
    }

    expect(invalidos).toEqual([]);
  });

  it("nenhuma combinacao produz codigo ambiguo com outra", () => {
    const gerados = ESCOLAS.flatMap((escola) =>
      CLASSES.map((classe) => montarCodigo(escola.sigla, 2026, 1, classe.sigla)),
    );

    expect(new Set(gerados).size).toBe(gerados.length);
  });
});
