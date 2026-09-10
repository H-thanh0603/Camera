-- Van don GHN/GHTK do admin nhap khi ban giao.
ALTER TABLE "Order" ADD COLUMN "trackingCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "carrier" TEXT;
