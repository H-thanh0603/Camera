-- Quản trị nội dung: SiteSetting (banner…) + Article (journal)
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "Article" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Camera Guides',
    "excerpt" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT 'Biên tập Lumina Journal',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readingTimeMinutes" INTEGER NOT NULL DEFAULT 5,
    "heroImage" TEXT NOT NULL DEFAULT '',
    "heroAlt" TEXT NOT NULL DEFAULT '',
    "body" JSONB NOT NULL,
    "relatedSlugs" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "Article_published_idx" ON "Article"("published");
