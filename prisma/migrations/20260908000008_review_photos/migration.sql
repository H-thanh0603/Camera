-- Review có ảnh thực tế + mã thưởng coupon
ALTER TABLE "Review" ADD COLUMN "photos" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Review" ADD COLUMN "rewardCode" TEXT;
