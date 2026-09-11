-- Meta riêng cổng thanh toán trên PaymentEvent (vd VNPay transactionNo/payDate cho refund)
ALTER TABLE "PaymentEvent" ADD COLUMN "meta" JSONB;
