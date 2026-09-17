-- OTP email cho lan bat 2FA dau tien qua challenge bootstrap (L4).
-- Portable SQLite/Postgres DDL. Apply separately after the production PG baseline.
CREATE TABLE "EmailOtp" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'totp-bootstrap',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP NOT NULL,
  "usedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailOtp_codeHash_key" ON "EmailOtp"("codeHash");
CREATE INDEX "EmailOtp_userId_idx" ON "EmailOtp"("userId");
