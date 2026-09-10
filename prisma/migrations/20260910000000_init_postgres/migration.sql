-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Escola" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "codigoCie" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "emitidoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Codigo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "loteId" TEXT NOT NULL,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Codigo_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Codigo_ano_idx" ON "Codigo"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "Codigo_escolaId_classeId_ano_sequencial_key" ON "Codigo"("escolaId", "classeId", "ano", "sequencial");

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Codigo" ADD CONSTRAINT "Codigo_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Codigo" ADD CONSTRAINT "Codigo_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Codigo" ADD CONSTRAINT "Codigo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

