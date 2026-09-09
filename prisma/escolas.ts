/**
 * Lista oficial das unidades da URE Suzano.
 *
 * Fonte dos nomes e dos codigos CIE: https://samucacs.github.io/escolas-suz-2026/
 * O cruzamento contra essa fonte fechou 63 para 63, sem escola faltando nem sobrando,
 * com 63 codigos CIE distintos. A URE cobre dois municipios: 46 unidades em Suzano e
 * 17 em Ferraz de Vasconcelos.
 *
 * ATENCAO: a sigla e IMUTAVEL depois da primeira emissao. Um codigo impresso em campo
 * carrega aquela sigla para sempre. Revise antes de emitir de verdade.
 *
 * As siglas tem 3 caracteres por medicao, nao por preferencia. Checagem de colisao:
 *
 *   2 caracteres -> 7 colisoes atingindo 16 escolas (AR, AS, JC, JS, LF, MS, RB)
 *   3 caracteres -> 0 colisoes
 *
 * Quatro siglas foram atribuidas a mao porque a regra automatica (iniciais das
 * palavras significativas) colidia:
 *
 *   URE  Unidade Regional De Ensino     - a unidade em si, nao uma escola
 *   ARO  ALICE ROMANOS                  - colidia com ALFREDO ROBERTO (ARL)
 *   JCO  JANDYRA COUTINHO               - colidia com JOSE CAMILO DE ANDRADE (JCA)
 *   RBE  CEL JTO A EE RAUL BRASIL PROF  - colidia com RAUL BRASIL PROF (RBA)
 *
 * RBA e RBE nao sao a mesma unidade duplicada: sao a escola Raul Brasil e o Centro de
 * Estudos de Linguas anexo a ela, cada um com CIE proprio.
 *
 * Dois CIEs terminam em letra (007171A, 921518A). Por isso codigoCie e String e a
 * validacao aceita alfanumerico - tratar como numero truncaria esses dois.
 *
 * PENDENTE: a URE em si nao tem CIE na fonte, entao fica "PENDENTE-URE". Se a URE nao
 * precisar emitir codigo para bem proprio, a linha pode simplesmente sair.
 */
export const ESCOLAS = [
  { sigla: "URE", codigoCie: "PENDENTE-URE", nome: "Unidade Regional De Ensino - Suzano" },
  { sigla: "ARL", codigoCie: "908460", nome: "ALFREDO ROBERTO" },
  { sigla: "ARO", codigoCie: "902949", nome: "ALICE ROMANOS PROFª" },
  { sigla: "ASS", codigoCie: "902937", nome: "ANDERSON DA SILVA SOARES" },
  { sigla: "ASD", codigoCie: "922109", nome: "ANGELA SUELI PONTES DIAS PROFª" },
  { sigla: "AFN", codigoCie: "007055", nome: "ANIS FADUL DOUTOR" },
  { sigla: "ABM", codigoCie: "923850", nome: "ANTONIO BRASILIO MENEZES DA FONSECA PROF" },
  { sigla: "AGN", codigoCie: "048884", nome: "ANTONIO GARCIA VEREADOR" },
  { sigla: "AJC", codigoCie: "912612", nome: "ANTONIO JOSE CAMPOS DE MENEZES PROF" },
  { sigla: "ARA", codigoCie: "041956", nome: "ANTONIO RODRIGUES DE ALMEIDA" },
  { sigla: "AVG", codigoCie: "904405", nome: "ANTONIO VALDEMAR GALO VEREADOR" },
  { sigla: "BRA", codigoCie: "035518", nome: "BATISTA RENZI" },
  { sigla: "BCM", codigoCie: "906293", nome: "BENEDITA DE CAMPOS MARCOLONGO PROFª" },
  { sigla: "BMN", codigoCie: "007024", nome: "BRASILIO MACHADO NETO COMENDADOR" },
  { sigla: "CRA", codigoCie: "007195", nome: "CARLINDO REIS" },
  { sigla: "CMA", codigoCie: "007067", nome: "CARLOS MOLTENI PROF" },
  { sigla: "CSH", codigoCie: "046197", nome: "CHOJIRO SEGAWA" },
  { sigla: "DJC", codigoCie: "006973", nome: "DAVID JORGE CURI PROF" },
  { sigla: "ECR", codigoCie: "007213", nome: "EDIR DO COUTO ROSA PROF" },
  { sigla: "EAS", codigoCie: "918623", nome: "ELIANE APARECIDA DANTAS DA SILVA PROF" },
  { sigla: "EIU", codigoCie: "906300", nome: "EUCLIDES IGESCA" },
  { sigla: "GJR", codigoCie: "007161", nome: "GERALDO JUSTINIANO DE REZENDE SILVA PROF" },
  { sigla: "GCI", codigoCie: "352603", nome: "GILBERTO DE CARVALHO PROF" },
  { sigla: "GBR", codigoCie: "007171A", nome: "GIOVANNI BATTISTA RAFFO PROF DOUTOR" },
  { sigla: "HZE", codigoCie: "007158", nome: "HELENA ZERRENNER" },
  { sigla: "IIJ", codigoCie: "007274", nome: "IIJIMA" },
  { sigla: "ICA", codigoCie: "007262", nome: "IGNES CORREA ALLEN PROF" },
  { sigla: "JYC", codigoCie: "921087", nome: "JACQUES YVES COUSTEAU COMANDANTE" },
  { sigla: "JCO", codigoCie: "901891", nome: "JANDYRA COUTINHO PROFª" },
  { sigla: "JSP", codigoCie: "925652", nome: "JARDIM SAO PAULO II" },
  { sigla: "JEV", codigoCie: "908502", nome: "JOSE EDUARDO VIEIRA RADUAN DOUTOR" },
  { sigla: "JBL", codigoCie: "908472", nome: "JOSE BENEDITO LEITE BARTHOLOMEI PROF" },
  { sigla: "JCA", codigoCie: "921518A", nome: "JOSE CAMILO DE ANDRADE" },
  { sigla: "JPO", codigoCie: "906281", nome: "JOSE PAPAIZ PROF" },
  { sigla: "JSL", codigoCie: "916559", nome: "JOVIANO SATLER DE LIMA PROF" },
  { sigla: "JFD", codigoCie: "908484", nome: "JUSSARA FEITOSA DOMSCHKE PROFª (VINCULADA A CLASSE HOSPITALAR)" },
  { sigla: "JMR", codigoCie: "041166", nome: "JUSTINO MARCONDES RANGEL PROF" },
  { sigla: "LSB", codigoCie: "007237", nome: "LANDIA SANTOS BATISTA PROFª" },
  { sigla: "LFL", codigoCie: "901885", nome: "LEDA FERNANDES LOPES PROFª" },
  { sigla: "LFK", codigoCie: "268297", nome: "LUCY FRANCO KOWALSKI PROFª" },
  { sigla: "LBU", codigoCie: "007183", nome: "LUIZ BIANCONI" },
  { sigla: "LHU", codigoCie: "923448", nome: "LUIZA HIDAKA PROFª" },
  { sigla: "MSP", codigoCie: "006944", nome: "MANUEL DOS SANTOS PAIVA" },
  { sigla: "MEA", codigoCie: "908915", nome: "MARIA ELISA DE AZEVEDO CINTRA PROFª" },
  { sigla: "MMD", codigoCie: "035506", nome: "MARIO MANOEL DANTAS DE AQUINO PROF" },
  { sigla: "MCC", codigoCie: "906311", nome: "MARTHA CALIXTO CAZAGRANDE" },
  { sigla: "MSA", codigoCie: "918684", nome: "MASAITI SEKINE PROF" },
  { sigla: "MOO", codigoCie: "006932", nome: "MORATO DE OLIVEIRA DOUTOR" },
  { sigla: "OLF", codigoCie: "923849", nome: "OLAVO LEONEL FERREIRA PROF" },
  { sigla: "OGL", codigoCie: "908927", nome: "OLZANETTI GOMES PROF" },
  { sigla: "OOL", codigoCie: "046450", nome: "OSWALDO DE OLIVEIRA LIMA" },
  { sigla: "PDI", codigoCie: "923291", nome: "CONJUNTO HABITACIONAL PARQUE DOURADO II" },
  { sigla: "PAP", codigoCie: "035531", nome: "PAULO AMERICO PAGANUCCI PROF" },
  { sigla: "PKA", codigoCie: "284361", nome: "PAULO KOBAYASHI PROF" },
  { sigla: "RBE", codigoCie: "985181", nome: "CEL JTO A EE RAUL BRASIL PROF" },
  { sigla: "RBA", codigoCie: "006981", nome: "RAUL BRASIL PROF" },
  { sigla: "RBO", codigoCie: "006993", nome: "ROBERTO BIANCHI" },
  { sigla: "SPV", codigoCie: "040514", nome: "SEBASTIAO PEREIRA VIDAL" },
  { sigla: "TZA", codigoCie: "925822", nome: "TACITO ZANCHETTA PREFEITO" },
  { sigla: "TYO", codigoCie: "925846", nome: "TOCHICHICO YOCHICAVA PROF" },
  { sigla: "TTO", codigoCie: "007146", nome: "TOKUZO TERAZAKI" },
  { sigla: "YBO", codigoCie: "916900", nome: "YOLANDA BASSI PROFª" },
  { sigla: "ZGA", codigoCie: "923436", nome: "ZELIA GATTAI AMADO" },
  { sigla: "ZFE", codigoCie: "007043", nome: "ZEIKICHI FUKUOKA" },
] as const;

/** As tres classes definidas pelo SEOM. Nao ha balde "Outros". */
export const CLASSES = [
  { sigla: "LB", nome: "Linha branca (artigos de cozinha)" },
  { sigla: "MOBI", nome: "Mobiliario" },
  { sigla: "TEC", nome: "Tecnologia" },
] as const;
