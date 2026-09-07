-- Khóa tài khoản vi phạm (spam review, gian lận coupon...)
ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;
