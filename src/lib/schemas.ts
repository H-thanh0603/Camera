import { z } from "zod";

/**
 * Schema validation DUY NHẤT dùng chung client (react-hook-form) + server (API routes).
 * Sửa rule ở đây là cả hai phía cập nhật — hết cảnh trùng lặp validation thủ công.
 */

const email = z.string().trim().min(1, "Email là bắt buộc.").email("Email không hợp lệ.");

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

export const shippingSchema = z.object({
  address: z.string().trim().min(4, "Địa chỉ là bắt buộc."),
  ward: z.string().trim().min(1, "Phường/xã là bắt buộc."),
  district: z.string().trim().min(1, "Quận/huyện là bắt buộc."),
  city: z.string().trim().min(1, "Tỉnh/thành phố là bắt buộc."),
  notes: z.string().trim().max(500).optional(),
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
  payment: z.enum(["bank_transfer", "cod", "card_on_delivery"]),
  lines: z.array(orderLineSchema).min(1, "Đơn hàng trống."),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ShippingInput = z.infer<typeof shippingSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type PlaceOrderInputDto = z.infer<typeof placeOrderSchema>;

/** Chuyển ZodError → { field: message } cho UI. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
