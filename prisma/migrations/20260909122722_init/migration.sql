-- CreateTable
CREATE TABLE "Escola" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sigla" TEXT NOT NULL,
    "codigoCie" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escolaId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "emitidoPor" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lote_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lote_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Codigo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "loteId" TEXT NOT NULL,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Codigo_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Codigo_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Codigo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Escola_sigla_key" ON "Escola"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Escola_codigoCie_key" ON "Escola"("codigoCie");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_sigla_key" ON "Classe"("sigla");

-- CreateIndex
CREATE INDEX "Lote_escolaId_classeId_idx" ON "Lote"("escolaId", "classeId");

-- CreateIndex
CREATE INDEX "Lote_criadoEm_idx" ON "Lote"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Codigo_codigo_key" ON "Codigo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Codigo_escolaId_classeId_sequencial_key" ON "Codigo"("escolaId", "classeId", "sequencial");
