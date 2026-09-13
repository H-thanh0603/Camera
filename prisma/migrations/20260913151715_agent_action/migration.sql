-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionHash" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AgentAction_sessionHash_status_idx" ON "AgentAction"("sessionHash", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAction_sessionHash_actionKey_key" ON "AgentAction"("sessionHash", "actionKey");
