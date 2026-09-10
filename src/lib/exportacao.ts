import * as XLSX from "xlsx";
import { CELULA_MAX_LENGTH } from "./config";
import type { CodigoDetalhado } from "./consultas";

/**
 * Geracao do .xlsx com SheetJS.
 *
 * Sobre o alerta do `npm audit` no pacote `xlsx`: as duas CVEs abertas
 * (GHSA-4r6h-8v6p-xvw6, prototype pollution, e GHSA-5pgg-2g8v-p4x9, ReDoS) estao no
 * caminho de LEITURA - ambas exigem dar parse num arquivo malicioso. Este sistema so
 * escreve, a partir de dados do proprio banco, e nunca abre planilha de terceiro.
 * Por isso o alerta nao se aplica na pratica e a versao foi mantida.
 *
 * Se um dia entrar importacao de planilha, isso muda: ai a versao precisa subir antes
 * de qualquer parse.
 */

/** Ordem das colunas definida pela especificacao. Nao reordenar sem combinar. */
const COLUNAS = [
  "Código",
  "Escola (sigla)",
  "Escola (nome)",
  "CIE",
  "Classe",
  "Sequencial",
  "Descrição do lote",
  "Emitido em",
  "Emitido por",
] as const;

const LARGURAS = [20, 14, 42, 12, 10, 12, 40, 20, 22];

function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

/**
 * Corta o que nao cabe numa celula de planilha.
 *
 * Rede de seguranca, nao regra de negocio: a emissao ja limita descricao e
 * "emitido por" bem abaixo disso. Mas texto acima do limite faz o SheetJS lancar ao
 * escrever, e isso derruba a exportacao INTEIRA - nao so a linha ruim. Como o backup
 * semanal depende do .xlsx, uma linha herdada ou editada a mao deixaria a base sem
 * backup. Melhor a planilha sair com um valor cortado e visivel do que nao sair.
 */
function caberNaCelula(valor: string): string {
  if (valor.length <= CELULA_MAX_LENGTH) return valor;
  const marca = "… [CORTADO]";
  return valor.slice(0, CELULA_MAX_LENGTH - marca.length) + marca;
}

export function montarPlanilha(codigos: CodigoDetalhado[]): Buffer {
  const linhas = codigos.map((c) => [
    c.codigo,
    c.escola.sigla,
    caberNaCelula(c.escola.nome),
    c.escola.codigoCie,
    c.classe.sigla,
    c.sequencial,
    caberNaCelula(c.lote.descricao),
    formatarDataHora(c.criadoEm),
    caberNaCelula(c.lote.emitidoPor),
  ]);

  const planilha = XLSX.utils.aoa_to_sheet([[...COLUNAS], ...linhas]);
  planilha["!cols"] = LARGURAS.map((wch) => ({ wch }));
  // Congela o cabecalho: a planilha e usada para conferir centenas de linhas.
  planilha["!freeze"] = { xSplit: 0, ySplit: 1 };

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Códigos");

  return XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Nome do arquivo com carimbo de data, para não sobrescrever exportações anteriores. */
export function nomeArquivoExportacao(agora = new Date()): string {
  const carimbo = agora.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `codigos-patrimonio-${carimbo}.xlsx`;
}
