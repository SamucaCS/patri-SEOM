import { describe, expect, it } from "vitest";
import { anoCorrente, montarCodigo } from "./config";

/**
 * O ano entra no codigo e nao tem conserto depois: quando o erro aparece, a etiqueta ja
 * esta colada no bem e o numero ja foi digitado no sistema do SEOM. Estes testes fixam
 * o instante para nao dependerem do relogio nem do fuso de quem roda a suite.
 */
describe("anoCorrente", () => {
  it("usa o ano de Suzano, nao o de UTC, na virada do ano", () => {
    // 31/12/2026 as 21:00 em Brasilia (UTC-3) ja e 01/01/2027 em UTC.
    const instante = new Date("2027-01-01T00:00:00Z");

    expect(instante.getUTCFullYear()).toBe(2027); // o que o relogio UTC diz
    expect(anoCorrente(instante)).toBe(2026); // o que vale para a URE
  });

  it("vira o ano no instante certo para Suzano", () => {
    // 23:59:59 de 31/12/2026 em Brasilia = 02:59:59 de 01/01/2027 em UTC.
    expect(anoCorrente(new Date("2027-01-01T02:59:59Z"))).toBe(2026);
    // 00:00:00 de 01/01/2027 em Brasilia = 03:00:00 em UTC.
    expect(anoCorrente(new Date("2027-01-01T03:00:00Z"))).toBe(2027);
  });

  it("nao depende do fuso do processo", () => {
    // Mesmo instante, mesma resposta - e o que um container em UTC precisa devolver.
    const instante = new Date("2027-01-01T01:30:00Z");
    const original = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const emUtc = anoCorrente(instante);
      process.env.TZ = "America/Sao_Paulo";
      const emBrasilia = anoCorrente(instante);
      expect(emUtc).toBe(2026);
      expect(emBrasilia).toBe(2026);
    } finally {
      process.env.TZ = original;
    }
  });

  it("acerta o meio do ano, onde nao ha ambiguidade", () => {
    expect(anoCorrente(new Date("2026-06-15T12:00:00Z"))).toBe(2026);
  });

  it("o ano que sai no codigo e o de Suzano", () => {
    const virada = new Date("2027-01-01T00:00:00Z");
    expect(montarCodigo("BR", anoCorrente(virada), 1, "MOBI")).toBe("SUZ-BR20260001-MOBI");
  });
});
