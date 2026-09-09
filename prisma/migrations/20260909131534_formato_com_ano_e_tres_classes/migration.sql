/*
  Warnings:

  - Added the required column `ano` to the `Codigo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ano` to the `Lote` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Codigo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "loteId" TEXT NOT NULL,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Codigo_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Codigo_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Codigo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Codigo" ("cancelado", "classeId", "codigo", "criadoEm", "escolaId", "id", "loteId", "sequencial") SELECT "cancelado", "classeId", "codigo", "criadoEm", "escolaId", "id", "loteId", "sequencial" FROM "Codigo";
DROP TABLE "Codigo";
ALTER TABLE "new_Codigo" RENAME TO "Codigo";
CREATE UNIQUE INDEX "Codigo_codigo_key" ON "Codigo"("codigo");
CREATE INDEX "Codigo_ano_idx" ON "Codigo"("ano");
CREATE UNIQUE INDEX "Codigo_escolaId_classeId_ano_sequencial_key" ON "Codigo"("escolaId", "classeId", "ano", "sequencial");
CREATE TABLE "new_Lote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escolaId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "emitidoPor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lote_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lote_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lote" ("classeId", "criadoEm", "descricao", "emitidoPor", "escolaId", "id", "quantidade") SELECT "classeId", "criadoEm", "descricao", "emitidoPor", "escolaId", "id", "quantidade" FROM "Lote";
DROP TABLE "Lote";
ALTER TABLE "new_Lote" RENAME TO "Lote";
CREATE INDEX "Lote_escolaId_classeId_idx" ON "Lote"("escolaId", "classeId");
CREATE INDEX "Lote_criadoEm_idx" ON "Lote"("criadoEm");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
