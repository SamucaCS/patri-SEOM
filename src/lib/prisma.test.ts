import { describe, expect, it } from "vitest";
import { normalizarPemDaCa } from "./prisma";

/**
 * Estes testes vieram de uma falha em producao, no primeiro deploy na Vercel.
 *
 * O PEM foi colado no painel e as quebras de linha viraram espaco. O OpenSSL descarta um
 * PEM assim EM SILENCIO - nao ha erro de "certificado invalido". A conexao entao e
 * validada contra o store padrao, que nao conhece a CA privada do Supabase, e o Postgres
 * responde `P1011: self-signed certificate in certificate chain`. A mensagem manda
 * investigar o servidor; o defeito estava na colagem.
 *
 * Por isso a normalizacao aceita as tres formas de colagem e o teste trava as tres.
 */

// Corpo base64 de mentira, com o tamanho suficiente para exercitar a quebra em 64.
const CORPO =
  "MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL" +
  "BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l" +
  "dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh";

const INICIO = "-----BEGIN CERTIFICATE-----";
const FIM = "-----END CERTIFICATE-----";

/** O formato canonico: cabecalho, corpo em linhas de 64, rodape. */
const CANONICO = [INICIO, CORPO.slice(0, 64), CORPO.slice(64, 128), CORPO.slice(128), FIM].join(
  "\n",
);

describe("normalizarPemDaCa", () => {
  it("aceita o PEM com quebras de linha reais, como vem do .env", () => {
    expect(normalizarPemDaCa(CANONICO)).toBe(CANONICO + "\n");
  });

  it("aceita o PEM com \\n escapado, que e o formato de campo de uma linha", () => {
    const umaLinha = CANONICO.split("\n").join("\\n");

    expect(normalizarPemDaCa(umaLinha)).toBe(CANONICO + "\n");
  });

  it("conserta o PEM cujas quebras viraram espaco - a falha que derrubou o deploy", () => {
    const comEspacos = CANONICO.split("\n").join(" ");

    // Sem normalizar, este e o valor que o OpenSSL descarta calado.
    expect(normalizarPemDaCa(comEspacos)).toBe(CANONICO + "\n");
  });

  it("nao se perde com CRLF nem com espaco em volta", () => {
    const sujo = "  " + CANONICO.split("\n").join("\r\n") + "  \r\n";

    expect(normalizarPemDaCa(sujo)).toBe(CANONICO + "\n");
  });

  it("preserva os dois certificados quando vem uma cadeia", () => {
    const dois = CANONICO + "\n" + CANONICO;

    expect(normalizarPemDaCa(dois)).toBe(CANONICO + "\n" + CANONICO + "\n");
  });

  it("recusa valor truncado: cabecalho sem rodape nao e PEM", () => {
    expect(() => normalizarPemDaCa(INICIO + "\n" + CORPO)).toThrow(/truncado/);
  });

  it("recusa texto que nao e PEM nenhum", () => {
    expect(() => normalizarPemDaCa("caminho/para/o/certificado.crt")).toThrow(
      /nao parece ser um PEM/,
    );
  });

  it("recusa bloco vazio: o cabecalho sozinho nao verifica nada", () => {
    expect(() => normalizarPemDaCa(INICIO + "\n\n" + FIM)).toThrow(/vazio ou truncado/);
  });
});
