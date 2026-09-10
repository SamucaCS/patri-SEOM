import { describe, expect, it } from "vitest";
import { CLASSES, ESCOLAS } from "../../prisma/escolas";
import {
  CODIGO_REGEX,
  SIGLA_CLASSE_MAX_LENGTH,
  SIGLA_CLASSE_MIN_LENGTH,
  SEQUENCIAL_MAX,
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

  it("nao tem codigo CIE repetido", () => {
    const cies = ESCOLAS.map((e) => e.codigoCie);
    const repetidos = cies.filter((c, i) => cies.indexOf(c) !== i);

    expect(repetidos).toEqual([]);
  });

  it("nenhuma unidade fica sem codigo CIE", () => {
    const pendentes = ESCOLAS.filter(
      (e) => e.codigoCie.trim() === "" || e.codigoCie.startsWith("PENDENTE"),
    );
    expect(pendentes).toEqual([]);
  });

  it("todo CIE e alfanumerico", () => {
    // Dois CIEs terminam em letra (007171A, 921518A): tratar como numero truncaria.
    const fora = ESCOLAS.filter((e) => !/^[0-9A-Z]+$/.test(e.codigoCie));
    expect(fora).toEqual([]);
  });

  it("preserva os CIEs que terminam em letra", () => {
    const comLetra = ESCOLAS.filter((e) => /[A-Z]$/.test(e.codigoCie)).map(
      (e) => e.codigoCie,
    );

    expect(comLetra.sort()).toEqual(["007171A", "921518A"]);
  });

  it("so o CIE da URE foge do padrao de 6 caracteres das escolas", () => {
    // Guarda a observacao, nao a impede: se o SEOM confirmar "010502", este teste
    // avisa que a linha mudou de forma.
    const foraDoPadrao = ESCOLAS.filter((e) => e.codigoCie.replace(/[A-Z]$/, "").length !== 6);

    expect(foraDoPadrao.map((e) => e.sigla)).toEqual(["UR"]);
  });

  it("distingue a escola Raul Brasil do CEL anexo", () => {
    const escola = ESCOLAS.find((e) => e.codigoCie === "006981");
    const cel = ESCOLAS.find((e) => e.codigoCie === "985181");

    // Nao sao a mesma unidade duplicada: cada uma tem sigla e CIE proprios.
    expect(escola?.sigla).toBe("RR");
    expect(cel?.sigla).toBe("RB");
    expect(escola?.sigla).not.toBe(cel?.sigla);
  });

  it("mantem os 9 desempates de sigla exatamente como revisados", () => {
    // Com 2 caracteres a regra automatica colide em 7 grupos. Estes 9 sao os que
    // ficaram com a alternativa livre. Se uma regeracao mudar qualquer um, a sigla
    // de uma escola muda - e sigla nao muda depois da primeira emissao.
    const desempates: Record<string, string> = {
      "902949": "AO", // ALICE ROMANOS         (natural AR)
      "041956": "AA", // ANTONIO RODRIGUES      (natural AR)
      "922109": "AP", // ANGELA SUELI PONTES    (natural AS)
      "921518A": "JA", // JOSE CAMILO           (natural JC)
      "916559": "JL", // JOVIANO SATLER         (natural JS)
      "268297": "LK", // LUCY FRANCO KOWALSKI   (natural LF)
      "918684": "MA", // MASAITI SEKINE         (natural MS)
      "006981": "RR", // RAUL BRASIL            (natural RB)
      "006993": "RI", // ROBERTO BIANCHI        (natural RB)
    };

    for (const [cie, sigla] of Object.entries(desempates)) {
      expect(ESCOLAS.find((e) => e.codigoCie === cie)?.sigla).toBe(sigla);
    }
  });

  /**
   * Duas siglas que sao anagrama uma da outra sao a troca de digitacao mais facil de
   * cometer e mais dificil de perceber: o codigo continua valido, existe, e aponta para
   * a escola errada. Nenhuma validacao pega isso - o bem fica lancado na outra unidade.
   *
   * Este teste NAO proibe anagrama. Ele congela os pares conhecidos: se a lista mudar,
   * a suite quebra e alguem decide de novo, em vez de o par entrar sem ninguem ver.
   */
  it("nao ganha par de anagrama novo sem revisao", () => {
    const conhecidos = new Set(["AP|PA", "AJ|JA", "BR|RB", "CM|MC"]);

    const grupos = new Map<string, string[]>();
    for (const escola of ESCOLAS) {
      const chave = escola.sigla.split("").sort().join("");
      grupos.set(chave, [...(grupos.get(chave) ?? []), escola.sigla]);
    }

    const encontrados = [...grupos.values()]
      .filter((siglas) => siglas.length > 1)
      .map((siglas) => [...siglas].sort().join("|"))
      .sort();

    expect(new Set(encontrados)).toEqual(conhecidos);
  });

  /**
   * LB e a sigla da escola Luiz Bianconi e tambem a da classe Linha branca. Nao quebra
   * nada - os campos tem posicao fixa e vivem em tabelas separadas - mas confunde quem
   * le, e SUZ-LB20260001-LB existe de verdade. Fica registrado, nao corrigido.
   */
  it("registra a colisao conhecida entre sigla de escola e sigla de classe", () => {
    const siglasDeClasse = new Set<string>(CLASSES.map((c) => c.sigla));
    const colisoes = ESCOLAS.filter((e) => siglasDeClasse.has(e.sigla)).map((e) => e.sigla);

    expect(colisoes).toEqual(["LB"]);
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
  it("bate com CODIGO_REGEX em toda combinacao escola x classe", () => {
    const invalidos: string[] = [];

    for (const escola of ESCOLAS) {
      for (const classe of CLASSES) {
        for (const sequencial of [1, 42, SEQUENCIAL_MAX]) {
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
