import { z } from "zod";

/**
 * Schema validation DUY NHẤT dùng chung client (react-hook-form) + server (API routes).
 * Sửa rule ở đây là cả hai phía cập nhật — hết cảnh trùng lặp validation thủ công.
 */

const email = z.string().trim().toLowerCase().min(1, "Email là bắt buộc.").email("Email không hợp lệ.");

/** SĐT Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx. */
export const phoneVN = z
  .string()
  .trim()
  .min(1, "Số điện thoại là bắt buộc.")
  .regex(/^(\+84|0)[\s.-]?\d{8,10}$/u, "Số điện thoại không hợp lệ (VD: 0901234567).")
  .transform((v) => v.replace(/[\s.-]/g, ""));

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên.").max(80),
  email,
  phone: phoneVN,
});

/** Mã số thuế VN: 10 số, chi nhánh thêm -001… */
export const taxCodeVN = z
  .string()
  .trim()
  .regex(/^\d{10}(-\d{3})?$/, "Mã số thuế gồm 10 số (chi nhánh thêm -XXX).");

export const shippingSchema = z
  .object({
    address: z.string().trim().min(4, "Địa chỉ là bắt buộc."),
    ward: z.string().trim().min(1, "Phường/xã là bắt buộc."),
    district: z.string().trim().min(1, "Quận/huyện là bắt buộc."),
    city: z.string().trim().min(1, "Tỉnh/thành phố là bắt buộc."),
    notes: z.string().trim().max(500).optional(),
    // Hóa đơn VAT: bỏ trống cả 3 = không xuất; điền thì phải đủ cả 3.
    companyName: z.string().trim().max(160).optional(),
    taxCode: z.string().trim().max(14).optional(),
    companyAddress: z.string().trim().max(220).optional(),
  })
  .superRefine((v, ctx) => {
    const filled = [v.companyName, v.taxCode, v.companyAddress].filter((s) => s && s.length > 0);
    if (filled.length > 0 && filled.length < 3) {
      ctx.addIssue({ code: "custom", message: "Xuất hóa đơn cần đủ tên công ty, mã số thuế và địa chỉ.", path: ["companyName"] });
    }
    if (v.taxCode) {
      const parsed = taxCodeVN.safeParse(v.taxCode);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Mã số thuế không hợp lệ.", path: ["taxCode"] });
      }
    }
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập họ tên."),
  email,
  password: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự."),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export const reviewSchema = z.object({
  author: z.string().trim().min(2, "Vui lòng nhập tên của bạn."),
  rating: z
    .number({ message: "Vui lòng chọn số sao từ 1 đến 5." })
    .int()
    .min(1, "Vui lòng chọn số sao từ 1 đến 5.")
    .max(5, "Vui lòng chọn số sao từ 1 đến 5."),
  title: z.string().trim().min(4, "Tiêu đề cần tối thiểu 4 ký tự.").max(120),
  body: z.string().trim().min(20, "Nội dung cần tối thiểu 20 ký tự.").max(2000),
  photos: z.array(z.string().url("URL ảnh không hợp lệ.")).max(3, "Tối đa 3 ảnh.").optional(),
});

export const orderLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).max(10),
});

export const placeOrderSchema = z.object({
  contact: contactSchema,
  shipping: shippingSchema,
  delivery: z.enum(["standard", "express", "pickup"]),
  payment: z.enum(["bank_transfer", "cod", "card_on_delivery", "vnpay"]),
  lines: z.array(orderLineSchema).min(1, "Đơn hàng trống."),
  idempotencyKey: z.string().min(8).max(64).optional(),
  guestToken: z
    .string()
    .min(32)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, "Token bảo mật không hợp lệ.")
    .optional(),
  couponCode: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Mã giảm giá không hợp lệ.")
    .optional(),
});

/** Resolve giá/stock hàng loạt cho client cache — bounded 50 ids. */
export const productResolveSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1, "Thiếu danh sách sản phẩm.").max(50, "Tối đa 50 sản phẩm một lần."),
});

export const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(60).optional(),
  brands: z.string().trim().max(300).optional().transform((v) => v?.split(",").map((s) => s.trim()).filter(Boolean)),
  category: z.string().trim().max(30).optional(),
  categories: z.string().trim().max(300).optional().transform((v) => v?.split(",").map((s) => s.trim()).filter(Boolean)),
  tag: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  inStockOnly: z.string().optional().transform((v) => v === "1" || v === "true"),
  slim: z.string().optional().transform((v) => v === "1" || v === "true"),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc", "rating_desc", "best_selling"]).default("featured"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ShippingInput = z.infer<typeof shippingSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type PlaceOrderInputDto = z.infer<typeof placeOrderSchema>;

/** Mã coupon chuẩn hoá: chữ hoa, số, gạch nối/gạch dưới. */
export const couponCodeSchema = z
  .string()
  .trim()
  .min(3, "Mã giảm giá tối thiểu 3 ký tự.")
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Mã giảm giá không hợp lệ.")
  .transform((v) => v.toUpperCase());

export const couponValidateSchema = z.object({
  code: couponCodeSchema,
  subtotal: z.number().int().min(0),
});

export const couponCreateSchema = z
  .object({
    code: couponCodeSchema,
    kind: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1, "Giá trị phải lớn hơn 0."),
    minSubtotal: z.number().int().min(0).default(0),
    maxUses: z.number().int().min(1).nullable().optional(),
    active: z.boolean().default(true),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((v) => (v.kind === "percent" ? v.value <= 90 : true), {
    message: "Phần trăm giảm tối đa 90%.",
    path: ["value"],
  });

export const couponUpdateSchema = z.object({
  kind: z.enum(["percent", "fixed"]).optional(),
  value: z.number().int().min(1).optional(),
  minSubtotal: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;

/**
 * Webhook cổng thanh toán (VNPay/MoMo/Stripe mapping về shape này ở tầng
 * adapter). Chữ ký HMAC-SHA256 hex của RAW body, gửi qua header
 * `x-payment-signature`. `timestamp` chống replay (lệch tối đa 5 phút).
 */
export const paymentWebhookSchema = z.object({
  provider: z.string().min(1).max(30),
  eventId: z.string().min(1).max(128),
  orderNumber: z.string().min(1).max(64),
  amount: z.number().int().min(0),
  status: z.enum(["paid", "failed"]),
  timestamp: z.number().int(),
});

export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;

/** Chuyển ZodError → { field: message } cho UI. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
