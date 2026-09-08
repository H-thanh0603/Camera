-- Lead thu cũ đổi mới
CREATE TABLE "TradeInLead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "deviceBrand" TEXT NOT NULL,
  "deviceModel" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TradeInLead_status_idx" ON "TradeInLead"("status");
