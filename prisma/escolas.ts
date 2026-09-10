/**
 * Lista oficial das unidades da URE Suzano.
 *
 * Fonte dos nomes e dos codigos CIE: https://samucacs.github.io/escolas-suz-2026/
 * O cruzamento contra essa fonte fechou 63 para 63, sem escola faltando nem sobrando.
 * A URE cobre dois municipios: 46 unidades em Suzano, 17 em Ferraz de Vasconcelos.
 * O codigo nao distingue os dois - o prefixo e SUZ para todas, por decisao do SEOM.
 *
 * ATENCAO: a sigla e IMUTAVEL depois da primeira emissao. Um codigo impresso em campo
 * carrega aquela sigla para sempre. Revise antes de emitir de verdade.
 *
 * As siglas tem 2 caracteres. Com 2 caracteres a regra automatica (iniciais das duas
 * primeiras palavras significativas) COLIDE: 7 colisoes atingindo 16 escolas. Sem
 * desempate, a segunda escola de cada colisao nunca conseguiria emitir - o
 * `codigo @unique` recusaria o registro para sempre.
 *
 * Por isso 9 siglas foram desempatadas, caindo para a proxima alternativa livre:
 *
 *   AO  ALICE ROMANOS                 (natural AR, ficou com ALFREDO ROBERTO)
 *   AA  ANTONIO RODRIGUES DE ALMEIDA  (natural AR)
 *   AP  ANGELA SUELI PONTES DIAS      (natural AS, ficou com ANDERSON DA SILVA SOARES)
 *   JA  JOSE CAMILO DE ANDRADE        (natural JC, ficou com JANDYRA COUTINHO)
 *   JL  JOVIANO SATLER DE LIMA        (natural JS, ficou com JARDIM SAO PAULO II)
 *   LK  LUCY FRANCO KOWALSKI          (natural LF, ficou com LEDA FERNANDES LOPES)
 *   MA  MASAITI SEKINE                (natural MS, ficou com MANUEL DOS SANTOS PAIVA)
 *   RR  RAUL BRASIL                   (natural RB, ficou com o CEL anexo)
 *   RI  ROBERTO BIANCHI               (natural RB)
 *
 * Nessas 9 a sigla NAO sai do nome. E o preco de 2 caracteres, e esta anotado aqui
 * porque quem opera vai precisar consultar em vez de deduzir.
 *
 * RB e RR nao sao a mesma unidade duplicada: sao o Centro de Estudos de Linguas anexo
 * ao Raul Brasil e a escola Raul Brasil, cada um com CIE proprio.
 *
 * Dois CIEs terminam em letra (007171A, 921518A). Por isso codigoCie e String e a
 * validacao aceita alfanumerico - tratar como numero truncaria esses dois.
 *
 * O CIE da URE (10502) veio do SEOM e nao da fonte acima, porque a URE nao e escola.
 * Observacao para conferencia: os 63 CIEs de escola tem 6 caracteres com zero a
 * esquerda, entao se o SEOM usar o mesmo padrao o valor seria "010502".
 */
export const ESCOLAS = [
  { sigla: "UR", codigoCie: "10502", nome: "Unidade Regional De Ensino - Suzano" },
  { sigla: "AR", codigoCie: "908460", nome: "ALFREDO ROBERTO" },
  { sigla: "AO", codigoCie: "902949", nome: "ALICE ROMANOS PROFª" },
  { sigla: "AS", codigoCie: "902937", nome: "ANDERSON DA SILVA SOARES" },
  { sigla: "AP", codigoCie: "922109", nome: "ANGELA SUELI PONTES DIAS PROFª" },
  { sigla: "AF", codigoCie: "007055", nome: "ANIS FADUL DOUTOR" },
  { sigla: "AB", codigoCie: "923850", nome: "ANTONIO BRASILIO MENEZES DA FONSECA PROF" },
  { sigla: "AG", codigoCie: "048884", nome: "ANTONIO GARCIA VEREADOR" },
  { sigla: "AJ", codigoCie: "912612", nome: "ANTONIO JOSE CAMPOS DE MENEZES PROF" },
  { sigla: "AA", codigoCie: "041956", nome: "ANTONIO RODRIGUES DE ALMEIDA" },
  { sigla: "AV", codigoCie: "904405", nome: "ANTONIO VALDEMAR GALO VEREADOR" },
  { sigla: "BR", codigoCie: "035518", nome: "BATISTA RENZI" },
  { sigla: "BC", codigoCie: "906293", nome: "BENEDITA DE CAMPOS MARCOLONGO PROFª" },
  { sigla: "BM", codigoCie: "007024", nome: "BRASILIO MACHADO NETO COMENDADOR" },
  { sigla: "CR", codigoCie: "007195", nome: "CARLINDO REIS" },
  { sigla: "CM", codigoCie: "007067", nome: "CARLOS MOLTENI PROF" },
  { sigla: "RB", codigoCie: "985181", nome: "CEL JTO A EE RAUL BRASIL PROF" },
  { sigla: "CS", codigoCie: "046197", nome: "CHOJIRO SEGAWA" },
  { sigla: "PD", codigoCie: "923291", nome: "CONJUNTO HABITACIONAL PARQUE DOURADO II" },
  { sigla: "DJ", codigoCie: "006973", nome: "DAVID JORGE CURI PROF" },
  { sigla: "EC", codigoCie: "007213", nome: "EDIR DO COUTO ROSA PROF" },
  { sigla: "EA", codigoCie: "918623", nome: "ELIANE APARECIDA DANTAS DA SILVA PROF" },
  { sigla: "EI", codigoCie: "906300", nome: "EUCLIDES IGESCA" },
  { sigla: "GJ", codigoCie: "007161", nome: "GERALDO JUSTINIANO DE REZENDE SILVA PROF" },
  { sigla: "GC", codigoCie: "352603", nome: "GILBERTO DE CARVALHO PROF" },
  { sigla: "GB", codigoCie: "007171A", nome: "GIOVANNI BATTISTA RAFFO PROF DOUTOR" },
  { sigla: "HZ", codigoCie: "007158", nome: "HELENA ZERRENNER" },
  { sigla: "IC", codigoCie: "007262", nome: "IGNES CORREA ALLEN PROF" },
  { sigla: "II", codigoCie: "007274", nome: "IIJIMA" },
  { sigla: "JY", codigoCie: "921087", nome: "JACQUES YVES COUSTEAU COMANDANTE" },
  { sigla: "JC", codigoCie: "901891", nome: "JANDYRA COUTINHO PROFª" },
  { sigla: "JS", codigoCie: "925652", nome: "JARDIM SAO PAULO II" },
  { sigla: "JB", codigoCie: "908472", nome: "JOSE BENEDITO LEITE BARTHOLOMEI PROF" },
  { sigla: "JA", codigoCie: "921518A", nome: "JOSE CAMILO DE ANDRADE" },
  { sigla: "JE", codigoCie: "908502", nome: "JOSE EDUARDO VIEIRA RADUAN DOUTOR" },
  { sigla: "JP", codigoCie: "906281", nome: "JOSE PAPAIZ PROF" },
  { sigla: "JL", codigoCie: "916559", nome: "JOVIANO SATLER DE LIMA PROF" },
  { sigla: "JF", codigoCie: "908484", nome: "JUSSARA FEITOSA DOMSCHKE PROFª (VINCULADA A CLASSE HOSPITALAR)" },
  { sigla: "JM", codigoCie: "041166", nome: "JUSTINO MARCONDES RANGEL PROF" },
  { sigla: "LS", codigoCie: "007237", nome: "LANDIA SANTOS BATISTA PROFª" },
  { sigla: "LF", codigoCie: "901885", nome: "LEDA FERNANDES LOPES PROFª" },
  { sigla: "LK", codigoCie: "268297", nome: "LUCY FRANCO KOWALSKI PROFª" },
  { sigla: "LB", codigoCie: "007183", nome: "LUIZ BIANCONI" },
  { sigla: "LH", codigoCie: "923448", nome: "LUIZA HIDAKA PROFª" },
  { sigla: "MS", codigoCie: "006944", nome: "MANUEL DOS SANTOS PAIVA" },
  { sigla: "ME", codigoCie: "908915", nome: "MARIA ELISA DE AZEVEDO CINTRA PROFª" },
  { sigla: "MM", codigoCie: "035506", nome: "MARIO MANOEL DANTAS DE AQUINO PROF" },
  { sigla: "MC", codigoCie: "906311", nome: "MARTHA CALIXTO CAZAGRANDE" },
  { sigla: "MA", codigoCie: "918684", nome: "MASAITI SEKINE PROF" },
  { sigla: "MO", codigoCie: "006932", nome: "MORATO DE OLIVEIRA DOUTOR" },
  { sigla: "OL", codigoCie: "923849", nome: "OLAVO LEONEL FERREIRA PROF" },
  { sigla: "OG", codigoCie: "908927", nome: "OLZANETTI GOMES PROF" },
  { sigla: "OO", codigoCie: "046450", nome: "OSWALDO DE OLIVEIRA LIMA" },
  { sigla: "PA", codigoCie: "035531", nome: "PAULO AMERICO PAGANUCCI PROF" },
  { sigla: "PK", codigoCie: "284361", nome: "PAULO KOBAYASHI PROF" },
  { sigla: "RR", codigoCie: "006981", nome: "RAUL BRASIL PROF" },
  { sigla: "RI", codigoCie: "006993", nome: "ROBERTO BIANCHI" },
  { sigla: "SP", codigoCie: "040514", nome: "SEBASTIAO PEREIRA VIDAL" },
  { sigla: "TZ", codigoCie: "925822", nome: "TACITO ZANCHETTA PREFEITO" },
  { sigla: "TY", codigoCie: "925846", nome: "TOCHICHICO YOCHICAVA PROF" },
  { sigla: "TT", codigoCie: "007146", nome: "TOKUZO TERAZAKI" },
  { sigla: "YB", codigoCie: "916900", nome: "YOLANDA BASSI PROFª" },
  { sigla: "ZF", codigoCie: "007043", nome: "ZEIKICHI FUKUOKA" },
  { sigla: "ZG", codigoCie: "923436", nome: "ZELIA GATTAI AMADO" },
] as const;

/** As tres classes definidas pelo SEOM. Nao ha balde "Outros". */
export const CLASSES = [
  { sigla: "LB", nome: "Linha branca (artigos de cozinha)" },
  { sigla: "MOBI", nome: "Mobiliario" },
  { sigla: "TEC", nome: "Tecnologia" },
] as const;
