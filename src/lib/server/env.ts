import { z } from "zod";

/**
 * Env validation tập trung cho backend.
 * Import ở server entry (route handler / server lib) để fail-fast khi
 * thiếu biến môi trường — thay vì lỗi ngầm lúc chạy (DB down, demo payment
 * bật nhầm ở production…).
 */

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL là bắt buộc."),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD production tối thiểu 12 ký tự.").optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  // Phase 1 production:
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).optional(),
  // VNPay (sandbox khi chưa có keys thật — thiếu keys thì vnpay-url 503):
  VNPAY_TMN_CODE: z.string().min(1).optional(),
  VNPAY_HASH_SECRET: z.string().min(8).optional(),
  VNPAY_PAY_URL: z.string().url().default("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),
  VNPAY_API_URL: z.string().url().default("https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"),
  VNPAY_RETURN_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  SENTRY_DSN: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Phase 2.3: R2 object storage (optional — thiếu thì upload 503)
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  TRUST_PROXY_COUNT: z.string().regex(/^\d+$/).optional(),
  // Vận chuyển: thiếu thì admin nhập mã vận đơn tay (manual).
  GHN_TOKEN: z.string().min(1).optional(),
  GHN_SHOP_ID: z.string().min(1).optional(),
  GHTK_TOKEN: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Biến môi trường không hợp lệ: ${details}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD là bắt buộc ở production.");
  }
  if (env.NODE_ENV === "production" && !(env.VNPAY_TMN_CODE && env.VNPAY_HASH_SECRET)) {
    throw new Error(
      "VNPAY_TMN_CODE + VNPAY_HASH_SECRET là bắt buộc ở production — không có keys thì vnpay-url 503, shop chết thanh toán.",
    );
  }
  // Redis rate-limit: đa instance mà thiếu Redis là bypass hết limiter.
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
  if ((redisUrl && !redisToken) || (!redisUrl && redisToken)) {
    throw new Error("UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN phải đi cùng nhau.");
  }
  if (env.NODE_ENV === "production" && !redisUrl) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL/TOKEN là bắt buộc ở production — fallback memory fail-open không chịu được đa instance.",
    );
  }
  // Client IP đáng tin: production phải sau proxy (TRUST_PROXY_COUNT>0)
  // hoặc chạy trên Vercel (platform tự đảm bảo x-real-ip). Self-host trần
  // mà không trust proxy → IP spoof được, limiter vô dụng.
  if (env.NODE_ENV === "production" && !(Number(env.TRUST_PROXY_COUNT ?? 0) > 0 || process.env.VERCEL)) {
    throw new Error("Production yêu cầu TRUST_PROXY_COUNT>0 (sau LB/proxy) hoặc deploy trên Vercel.");
  }
  cached = env;
  return cached;
}

/** true khi chạy production thật — dùng để chặn endpoint demo. */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/** Chỉ dùng trong test để reset cache. */
export function __resetEnvCache(): void {
  cached = null;
}
