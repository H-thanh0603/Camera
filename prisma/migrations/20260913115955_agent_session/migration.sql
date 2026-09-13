/*
  Warnings:

  - You are about to alter the column `saleEndsAt` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("timestamp(3)")` to `DateTime`.
  - You are about to alter the column `seedTotal` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("double precision")` to `Float`.
  - You are about to alter the column `photos` on the `Review` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `productIds` on the `SavedBattle` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- CreateTable
CREATE TABLE "AgentSession" (
    "idHash" TEXT NOT NULL PRIMARY KEY,
    "messages" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Coupon" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "minSubtotal" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Coupon" ("active", "code", "createdAt", "expiresAt", "kind", "maxUses", "minSubtotal", "updatedAt", "usedCount", "value") SELECT "active", "code", "createdAt", "expiresAt", "kind", "maxUses", "minSubtotal", "updatedAt", "usedCount", "value" FROM "Coupon";
DROP TABLE "Coupon";
ALTER TABLE "new_Coupon" RENAME TO "Coupon";
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "saleEndsAt" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "availability" TEXT NOT NULL DEFAULT 'in_stock',
    "images" JSONB NOT NULL,
    "thumbnail" JSONB NOT NULL,
    "specifications" JSONB NOT NULL,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "seedCount" INTEGER NOT NULL DEFAULT 0,
    "seedTotal" REAL NOT NULL DEFAULT 0,
    "tags" JSONB NOT NULL,
    "tagString" TEXT NOT NULL DEFAULT '|',
    "searchText" TEXT NOT NULL DEFAULT '',
    "badges" JSONB NOT NULL,
    "monthlyFrom" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "highlights" JSONB,
    "inTheBox" JSONB,
    "compatibleWith" JSONB
);
INSERT INTO "new_Product" ("availability", "badges", "brand", "category", "compareAtPrice", "compatibleWith", "createdAt", "currency", "description", "highlights", "id", "images", "inTheBox", "monthlyFrom", "name", "price", "rating", "reviewCount", "saleEndsAt", "searchText", "seedCount", "seedTotal", "shortDescription", "sku", "slug", "specifications", "stock", "subcategory", "tagString", "tags", "thumbnail", "updatedAt") SELECT "availability", "badges", "brand", "category", "compareAtPrice", "compatibleWith", "createdAt", "currency", "description", "highlights", "id", "images", "inTheBox", "monthlyFrom", "name", "price", "rating", "reviewCount", "saleEndsAt", "searchText", "seedCount", "seedTotal", "shortDescription", "sku", "slug", "specifications", "stock", "subcategory", "tagString", "tags", "thumbnail", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
CREATE INDEX "Product_price_idx" ON "Product"("price");
CREATE INDEX "Product_rating_idx" ON "Product"("rating");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
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
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Review" ("approved", "author", "body", "createdAt", "id", "photos", "productId", "rating", "rewardCode", "title", "userId", "verified") SELECT "approved", "author", "body", "createdAt", "id", "photos", "productId", "rating", "rewardCode", "title", "userId", "verified" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_productId_idx" ON "Review"("productId");
CREATE INDEX "Review_approved_idx" ON "Review"("approved");
CREATE INDEX "Review_productId_approved_idx" ON "Review"("productId", "approved");
CREATE TABLE "new_SavedBattle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "productIds" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedBattle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SavedBattle" ("createdAt", "id", "name", "productIds", "userId") SELECT "createdAt", "id", "name", "productIds", "userId" FROM "SavedBattle";
DROP TABLE "SavedBattle";
ALTER TABLE "new_SavedBattle" RENAME TO "SavedBattle";
CREATE INDEX "SavedBattle_userId_idx" ON "SavedBattle"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AgentSession_expiresAt_idx" ON "AgentSession"("expiresAt");
