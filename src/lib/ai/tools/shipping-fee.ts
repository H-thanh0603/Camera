/**
 * External-service tool — `check_shipping_fee`: hỏi GHN phí vận chuyển
 * thật cho một sản phẩm + địa chỉ đích. Đây là tool "agent kết nối dịch
 * vụ ngoài": HTTP sang online-gateway.ghn.vn với env token, kết quả
 * cache Redis 1 giờ để không spam API third-party.
 *
 * Read-only về phía shop (không tạo đơn vận chuyển). GHN chưa cấu hình
 * → ToolRunError unavailable với hướng dẫn (agent vẫn trả lời được).
 */

import { z } from "zod";
import type { CommerceTool } from "../agent/executor";
import { ToolRunError } from "../agent/executor";
import type { CommerceDataSource } from "./data-source";

const feeSchema = z.object({
  productId: z.string().min(1).max(80).describe("id sản phẩm cần tính phí"),
  toDistrictId: z.number().int().min(1).max(10000).describe("mã quận/huyện GHN của khách"),
  toWardCode: z.string().min(1).max(20).optional().describe("mã phường/xã GHN (chính xác hơn nếu có)"),
});

const GHN_BASE = "https://online-gateway.ghn.vn/shiip/public-api/v2";
const CACHE_TTL_S = 3600;

export function checkShippingFeeTool(source: CommerceDataSource): CommerceTool<typeof feeSchema, unknown> {
  return {
    name: "check_shipping_fee",
    description:
      "Hỏi GHN phí vận chuyển thật (VND) cho 1 sản phẩm đến quận/huyện GHN (mã district GHN, ví dụ 1444 = Quận 1 TP.HCM). Trả phí + thời gian dự kiến. Dùng khi khách hỏi phí ship.",
    input: feeSchema,
    run: async (args) => {
      const token = process.env.GHN_TOKEN?.trim();
      const shopId = process.env.GHN_SHOP_ID?.trim();
      if (!token || !shopId) {
        throw new ToolRunError("unavailable", "Chưa kết nối API GHN nên chưa báo phí ship chính xác được. Nhờ khách xem phí ở bước thanh toán hoặc liên hệ concierge.");
      }

      // Trọng lượng mặc định 2kg nếu sản phẩm không khai báo — camera + phụ kiện.
      const product = (await source.getProduct({ id: args.productId })) ?? (await source.getProduct({ slug: args.productId }));
      if (!product) throw new ToolRunError("not_found", "Không tìm thấy sản phẩm để tính phí.");

      const cacheKey = `lumina:ghn-fee:${args.toDistrictId}:${args.toWardCode ?? "any"}:${product.id}`;
      const { getRedisClient } = await import("@/lib/edge-rate-limit");
      const redis = getRedisClient();
      try {
        const cached = redis ? await redis.get(cacheKey) : null;
        if (cached) {
          const parsed = JSON.parse(cached as string) as { feeVND: number; days: string };
          return { ...parsed, cached: true };
        }
      } catch {
        // Cache fail → gọi thẳng, không chặn
      }

      const { fetchWithTimeout } = await import("@/lib/server/fetch");
      const res = await fetchWithTimeout(`${GHN_BASE}/shipping-order/fee`, {
        method: "POST",
        headers: { Token: token, ShopId: shopId, "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type_id: 2, // standard
          to_district_id: args.toDistrictId,
          ...(args.toWardCode ? { to_ward_code: args.toWardCode } : {}),
          weight: 2000,
        }),
      });
      if (!res.ok) {
        throw new ToolRunError("unavailable", "GHN không phản hồi phí được lúc này. Xin lỗi khách và đề nghị thử lại sau.");
      }
      const body = (await res.json()) as { code?: number; data?: { total?: number; expected_delivery_time?: string } };
      if (body.code !== 200 || !body.data?.total) {
        throw new ToolRunError("unavailable", "GHN không tính được phí cho địa chỉ này. Đề nghị khách kiểm tra mã quận/huyện.");
      }
      const out = {
        feeVND: body.data.total,
        days: body.data.expected_delivery_time ?? "1–3 ngày",
      };
      try {
        await redis?.set(cacheKey, JSON.stringify(out), { ex: CACHE_TTL_S });
      } catch {
        // Cache fail là best-effort
      }
      return out;
    },
  };
}
