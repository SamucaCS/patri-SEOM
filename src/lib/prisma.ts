import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Duas conexoes, de proposito.
 *
 * `DATABASE_URL` e o pooler do Supabase (porta 6543, `?pgbouncer=true`). Na Vercel cada
 * invocacao serverless abriria uma conexao propria e o Postgres estouraria o limite; o
 * pooler existe para absorver isso. Serve para leitura e escrita simples.
 *
 * `DIRECT_URL` e a conexao direta (porta 5432). A transacao interativa de emissao TEM
 * que sair por aqui. Duas razoes, e as duas sao fatais:
 *
 *   1. Transacao interativa por pooler em transaction mode nao se sustenta: o pooler
 *      devolve a conexao ao pool entre statements, entao BEGIN, o SELECT e o INSERT
 *      podem cair em backends diferentes.
 *   2. `pg_advisory_xact_lock` vive na transacao de UMA conexao. Se o statement seguinte
 *      for para outro backend, o lock nao existe para ele - e a serializacao que o lock
 *      deveria dar simplesmente nao acontece, sem erro nenhum.
 *
 * O item 2 e o perigoso: falha calada, e o sintoma e codigo de patrimonio duplicado.
 */

function exigir(nome: "DATABASE_URL" | "DIRECT_URL"): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `${nome} nao definida. Confira as variaveis de ambiente (.env local, ou o painel ` +
        "da Vercel em producao). Ver INSTALL.md.",
    );
  }
  return valor;
}

const PEM_INICIO = "-----BEGIN CERTIFICATE-----";
const PEM_FIM = "-----END CERTIFICATE-----";

/**
 * Normaliza o PEM da CA, venha ele no formato que vier.
 *
 * Isto existe por causa de uma falha real em producao, e a mensagem dela apontava para o
 * lugar errado: o PEM chegou na Vercel com as quebras de linha viradas em ESPACO. O
 * OpenSSL nao aceita esse formato, mas tambem nao reclama - ele descarta o certificado
 * EM SILENCIO. O Node entao valida a conexao contra o store padrao, nao acha a CA do
 * Supabase (que e privada) e falha com "self-signed certificate in certificate chain".
 * Quem le esse erro vai investigar o servidor, o pooler, o sslmode - nunca a colagem.
 *
 * Base64 nao tem espaco nem quebra de linha significativa, entao reconstruir o bloco a
 * partir so dos caracteres validos e seguro e deterministico: aceita PEM com quebras
 * reais (dotenv com aspas), com `\n` escapado (campo de uma linha do painel), ou com as
 * quebras comidas pelo caminho. O conteudo do certificado e o mesmo nos tres casos - isto
 * conserta a FORMA, nunca o que esta sendo verificado.
 *
 * Exportada para poder ser testada sem abrir conexao.
 */
export function normalizarPemDaCa(bruto: string): string {
  const comQuebras = bruto.includes("\\n") ? bruto.replace(/\\n/g, "\n") : bruto;

  const blocos = [
    ...comQuebras.matchAll(
      /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g,
    ),
  ];

  if (blocos.length === 0) {
    throw new Error(
      "SUPABASE_CA_CERT nao parece ser um PEM: nao ha um bloco completo entre " +
        `${PEM_INICIO} e ${PEM_FIM}. Confira se o valor nao ficou truncado ou se ` +
        "sobraram aspas do .env. Ver INSTALL.md.",
    );
  }

  return (
    blocos
      .map((bloco) => {
        const corpo = bloco[1].replace(/[^A-Za-z0-9+/=]/g, "");
        if (corpo.length === 0) {
          throw new Error(
            "SUPABASE_CA_CERT tem o cabecalho do PEM mas nenhum conteudo entre " +
              "BEGIN e END. O valor chegou vazio ou truncado.",
          );
        }
        const linhas = corpo.match(/.{1,64}/g) ?? [];
        return [PEM_INICIO, ...linhas, PEM_FIM].join("\n");
      })
      .join("\n") + "\n"
  );
}

/**
 * TLS com verificacao completa da identidade do servidor.
 *
 * A CA vem em `SUPABASE_CA_CERT`, como conteudo PEM - nao como caminho de arquivo. Num
 * deploy serverless nao ha sistema de arquivos confiavel para apontar, e caminho
 * relativo quebra dependendo de onde o processo sobe; PEM em variavel de ambiente vale
 * igual na Vercel, no `.env` local e num script de manutencao.
 *
 * Sem a CA isto FALHA, de proposito. O estado anterior era `sslmode=no-verify`, que
 * criptografa mas aceita qualquer certificado - ou seja, nao protege contra alguem no
 * meio do caminho. Falhar e melhor que degradar em silencio para o modo fraco.
 */
function certificadoCa(): string {
  const bruto = process.env.SUPABASE_CA_CERT?.trim();

  if (!bruto) {
    throw new Error(
      "SUPABASE_CA_CERT nao definida. Ela carrega o certificado da CA do Supabase (o " +
        "conteudo PEM, nao o caminho) e e o que permite verificar a identidade do " +
        "servidor. Sem ela a conexao so poderia seguir sem verificar, o que este " +
        "codigo recusa. Ver INSTALL.md.",
    );
  }

  return normalizarPemDaCa(bruto);
}

/**
 * Opcoes de TLS para o `pg`. Exportada porque os scripts de manutencao e o harness de
 * teste abrem `pg.Client` direto e precisam da mesma verificacao.
 */
export function opcoesSslPg(): { ca: string; rejectUnauthorized: true } {
  return { ca: certificadoCa(), rejectUnauthorized: true };
}

/**
 * Tira `sslmode` da URL.
 *
 * Se a URL ainda trouxer `sslmode=no-verify` de uma configuracao antiga, ela venceria a
 * verificacao que acabamos de montar - e voltaria ao modo fraco sem avisar.
 */
function semSslmode(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*&?/g, "$1").replace(/[?&]$/, "");
}

/**
 * Client apontado para uma URL especifica.
 *
 * `schema` existe para os testes: cada arquivo de teste roda no seu proprio schema do
 * Postgres, para nao disputar as mesmas tabelas com os outros. Em producao fica no
 * default (`public`).
 */
export function criarPrismaClient(url?: string, schema?: string): PrismaClient {
  const adapter = new PrismaPg(
    {
      connectionString: semSslmode(url ?? exigir("DATABASE_URL")),
      ssl: opcoesSslPg(),
    },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}

/**
 * Client da conexao DIRETA, exclusivo da emissao.
 *
 * Nao reaproveita `criarPrismaClient` para que a escolha da URL fique explicita: quem
 * ler esta funcao precisa ver que ela ignora o pooler de proposito.
 */
export function criarPrismaClientDireto(url?: string, schema?: string): PrismaClient {
  const adapter = new PrismaPg(
    {
      connectionString: semSslmode(url ?? exigir("DIRECT_URL")),
      ssl: opcoesSslPg(),
    },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDireto?: PrismaClient;
};

/**
 * Singleton preguicoso do client do pooler.
 *
 * Nao e criado no import: assim importar a logica de emissao nao abre conexao com o
 * banco (os testes dependem disso). Em dev o Next recarrega o modulo a cada edicao, e
 * guardar no globalThis evita abrir uma conexao nova por recarga.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = criarPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Singleton preguicoso do client direto. So a emissao usa. */
export function getPrismaDireto(): PrismaClient {
  if (!globalForPrisma.prismaDireto) {
    globalForPrisma.prismaDireto = criarPrismaClientDireto();
  }
  return globalForPrisma.prismaDireto;
}
