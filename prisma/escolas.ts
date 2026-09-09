/**
 * Lista oficial das unidades da URE Suzano.
 *
 * ATENCAO: a sigla e IMUTAVEL depois da primeira emissao. Um codigo impresso em campo
 * carrega aquela sigla para sempre. Revise antes de emitir de verdade.
 *
 * As siglas tem 3 caracteres por medicao, nao por preferencia. Checagem de colisao
 * contra estas 64 entradas:
 *
 *   2 caracteres -> 7 colisoes atingindo 16 escolas (AR, AS, JC, JS, LF, MS, RB)
 *   3 caracteres -> 0 colisoes
 *
 * Quatro siglas foram resolvidas a mao porque a regra automatica (iniciais das
 * palavras significativas) colidia:
 *
 *   URE  Unidade Regional De Ensino    - a unidade em si, nao uma escola
 *   ARO  ALICE ROMANOS                 - colidia com ALFREDO ROBERTO (ARL)
 *   JCO  JANDYRA COUTINHO              - colidia com JOSE CAMILO DE ANDRADE (JCA)
 *   RBE  RAUL BRASIL PROF EE           - colidia com RAUL BRASIL PROF (RBA)
 *
 * PENDENTE: os codigos CIE. O campo e obrigatorio e unico no schema, entao entra aqui
 * um placeholder "PENDENTE-<sigla>", visivelmente falso. Preencher pela tela de
 * Cadastros antes da primeira emissao real.
 *
 * PENDENTE: "RAUL BRASIL PROF EE" e "RAUL BRASIL PROF" parecem ser a mesma escola
 * duplicada na lista de origem. Confirmar com o SEOM e remover uma das duas.
 */
export const ESCOLAS = [
  { sigla: "URE", nome: "Unidade Regional De Ensino - Suzano" },
  { sigla: "ARL", nome: "ALFREDO ROBERTO" },
  { sigla: "ARO", nome: "ALICE ROMANOS PROFª" },
  { sigla: "ASS", nome: "ANDERSON DA SILVA SOARES" },
  { sigla: "ASD", nome: "ANGELA SUELI P DIAS" },
  { sigla: "AFN", nome: "ANIS FADUL DOUTOR" },
  { sigla: "ABM", nome: "ANTONIO BRASILIO MENEZES DA FONSECA PROF" },
  { sigla: "AGN", nome: "ANTONIO GARCIA VEREADOR" },
  { sigla: "AJC", nome: "ANTONIO JOSE CAMPOS DE MENEZES PROF" },
  { sigla: "ARA", nome: "ANTONIO RODRIGUES DE ALMEIDA" },
  { sigla: "AVG", nome: "ANTONIO VALDEMAR GALO VEREADOR" },
  { sigla: "BRA", nome: "BATISTA RENZI" },
  { sigla: "BCM", nome: "BENEDITA DE CAMPOS MARCOLONGO PROFª" },
  { sigla: "BMN", nome: "BRASILIO MACHADO NETO COMENDADOR" },
  { sigla: "CRA", nome: "CARLINDO REIS" },
  { sigla: "CMA", nome: "CARLOS MOLTENI PROF" },
  { sigla: "CSH", nome: "CHOJIRO SEGAWA" },
  { sigla: "DJC", nome: "DAVID JORGE CURI PROF" },
  { sigla: "ECR", nome: "EDIR DO COUTO ROSA" },
  { sigla: "EAS", nome: "ELIANE APARECIDA D DA SILVA" },
  { sigla: "EIU", nome: "EUCLIDES IGESCA" },
  { sigla: "GJR", nome: "GERALDO JUSTINIANO DE REZENDE SILVA PROF" },
  { sigla: "GCI", nome: "GILBERTO DE CARVALHO PROF" },
  { sigla: "GBR", nome: "GIOVANNI BATTISTA RAFFO PROF DOUTOR" },
  { sigla: "HZE", nome: "HELENA ZERRENNER" },
  { sigla: "IIJ", nome: "IIJIMA" },
  { sigla: "ICA", nome: "IGNES CORREA ALLEN" },
  { sigla: "JYC", nome: "JACQUES YVES COUSTEAU COMANDANTE" },
  { sigla: "JCO", nome: "JANDYRA COUTINHO PROFª" },
  { sigla: "JSP", nome: "JARDIM SAO PAULO II" },
  { sigla: "JEV", nome: "Jose Eduardo Viera Raduan" },
  { sigla: "JBL", nome: "JOSE BENEDITO LEITE BARTHOLOMEI PROF" },
  { sigla: "JCA", nome: "JOSE CAMILO DE ANDRADE" },
  { sigla: "JPO", nome: "JOSE PAPAIZ PROF" },
  { sigla: "JSL", nome: "JOVIANO SATLER DE LIMA PROF" },
  { sigla: "JFD", nome: "JUSSARA FEITOSA DOMSCHKE PROFª" },
  { sigla: "JMR", nome: "Justino Marcondes Rangel" },
  { sigla: "LSB", nome: "Landia dos Santos Batista" },
  { sigla: "LFL", nome: "LEDA FERNANDES LOPES PROFª" },
  { sigla: "LFK", nome: "LUCY FRANCO KOWALSKI PROFª" },
  { sigla: "LBU", nome: "LUIZ BIANCONI" },
  { sigla: "LHU", nome: "LUIZA HIDAKA PROFª" },
  { sigla: "MSP", nome: "MANUEL DOS SANTOS PAIVA" },
  { sigla: "MEA", nome: "MARIA ELISA DE AZEVEDO CINTRA PROFª" },
  { sigla: "MMD", nome: "Mario Manoel Dantas de Aquino" },
  { sigla: "MCC", nome: "MARTHA CALIXTO CAZAGRANDE" },
  { sigla: "MSA", nome: "MASAITI SEKINE PROF" },
  { sigla: "MOO", nome: "MORATO DE OLIVEIRA DOUTOR" },
  { sigla: "OLF", nome: "OLAVO LEONEL FERREIRA PROF" },
  { sigla: "OGL", nome: "OLZANETTI GOMES PROFESSOR" },
  { sigla: "OOL", nome: "OSWALDO DE OLIVEIRA LIMA" },
  { sigla: "PDI", nome: "PARQUE DOURADO II" },
  { sigla: "PAP", nome: "PAULO AMERICO PAGANUCCI" },
  { sigla: "PKA", nome: "PAULO KOBAYASHI PROF" },
  { sigla: "RBE", nome: "RAUL BRASIL PROF EE" },
  { sigla: "RBA", nome: "RAUL BRASIL PROF" },
  { sigla: "RBO", nome: "ROBERTO BIANCHI" },
  { sigla: "SPV", nome: "SEBASTIAO PEREIRA VIDAL" },
  { sigla: "TZA", nome: "Tacito Zancheta" },
  { sigla: "TYO", nome: "TOCHICHICO YOCHICAVA PROF" },
  { sigla: "TTO", nome: "TOKUZO TERAZAKI" },
  { sigla: "YBO", nome: "YOLANDA BASSI PROFª" },
  { sigla: "ZGA", nome: "ZELIA GATTAI AMADO" },
  { sigla: "ZFE", nome: "ZEIKICHI FUKUOKA" },
] as const;

/** As tres classes definidas pelo SEOM. Nao ha balde "Outros". */
export const CLASSES = [
  { sigla: "LB", nome: "Linha branca (artigos de cozinha)" },
  { sigla: "MOBI", nome: "Mobiliario" },
  { sigla: "TEC", nome: "Tecnologia" },
] as const;
