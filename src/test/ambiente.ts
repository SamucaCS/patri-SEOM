import "dotenv/config";

/**
 * Setup do Vitest: so carrega o .env.
 *
 * Existe porque o Vitest nao le .env por conta propria, e os testes deste projeto
 * rodam contra um Postgres real - nao ha banco em memoria de proposito. Sem isso,
 * `DIRECT_URL` chega vazia e todo `beforeEach` estoura.
 */
