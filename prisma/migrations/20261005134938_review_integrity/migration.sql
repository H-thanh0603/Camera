-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "photos" JSONB NOT NULL DEFAULT [],
    "rewardCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Dọn data lịch sử trước khi copy (FK CASCADE + UNIQUE sẽ fail nếu còn orphan/dup):
-- 1) review trỏ product không tồn tại → xóa.
DELETE FROM "Review" WHERE "productId" NOT IN (SELECT "id" FROM "Product");
-- 2) trùng (productId, userId) → giữ review mới nhất (guest có userId NULL
--    không bị unique ràng buộc — SQLite coi NULL là khác nhau).
DELETE FROM "Review" WHERE "userId" IS NOT NULL AND "id" NOT IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "productId", "userId" ORDER BY "createdAt" DESC, "id" DESC) AS rn
        FROM "Review" WHERE "userId" IS NOT NULL
    ) WHERE rn = 1
);
INSERT INTO "new_Review" ("approved", "author", "body", "createdAt", "id", "photos", "productId", "rating", "rewardCode", "title", "userId", "verified") SELECT "approved", "author", "body", "createdAt", "id", "photos", "productId", "rating", "rewardCode", "title", "userId", "verified" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_productId_idx" ON "Review"("productId");
CREATE INDEX "Review_approved_idx" ON "Review"("approved");
CREATE INDEX "Review_productId_approved_idx" ON "Review"("productId", "approved");
CREATE UNIQUE INDEX "Review_productId_userId_key" ON "Review"("productId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
