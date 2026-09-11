import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /**
     * Carrega o .env antes de qualquer teste.
     *
     * O Vitest nao le .env sozinho, e os testes rodam contra um Postgres de verdade -
     * sem DIRECT_URL eles nao tem banco e falham no primeiro `beforeEach`.
     */
    setupFiles: ["src/test/ambiente.ts"],
    /**
     * Cada arquivo de teste cria seu proprio SCHEMA no Postgres. Rodar arquivos em
     * paralelo multiplicaria conexoes no pooler sem provar nada a mais - e o que
     * importa aqui (concorrencia sob advisory lock) e testado dentro de um arquivo, com
     * conexoes proprias.
     */
    fileParallelism: false,
    /**
     * Folgado de proposito: o banco e remoto (us-west-2) e cada ida e volta custa
     * ~200ms. Um teste que cria escola, classe e 200 codigos faz muitas.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
