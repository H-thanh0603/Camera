-- Portable SQLite/Postgres DDL. Apply separately after the production PG baseline.
CREATE TABLE "MerchantDescriptionDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "before" TEXT NOT NULL,
  "after" TEXT NOT NULL,
  "productUpdatedAt" TIMESTAMP NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdBy" TEXT NOT NULL,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MerchantDescriptionDraft_createdAt_idx" ON "MerchantDescriptionDraft"("createdAt");
CREATE INDEX "MerchantDescriptionDraft_productId_status_idx" ON "MerchantDescriptionDraft"("productId", "status");
CREATE TABLE "MerchantDraftBudget" (
  "month" TEXT NOT NULL PRIMARY KEY,
  "reservedTokens" INTEGER NOT NULL DEFAULT 0
);
