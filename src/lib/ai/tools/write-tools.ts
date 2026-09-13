/**
 * Write tools — hành động ghi, mỗi lần chạy PHẢI qua user approval
 * (prepareAction → AgentAction pending → user duyệt → execute).
 *
 *   add_to_cart : agent đề xuất thêm món vào GIỎ CỦA CLIENT. Giỏ là
 *                client-state (store) nên tool chỉ "soạn" món; khi user
 *                duyệt, endpoint trả payload cho widget tự thêm qua store —
 *                server không ghi giỏ thay client.
 *   watch_price : ủy quyền nhiệm vụ nền — cron so giá mỗi giờ, email qua
 *                outbox khi giá ≤ ngưỡng. Đây là "delegate" thật sự: agent
 *                nhận việc, chạy cả khi user offline.
 *
 * Cả hai KHÔNG đụng đơn hàng/thanh toán (checkout vẫn của web).
 */

import { z } from "zod";
import type { CommerceTool, ToolContext } from "../agent/executor";
import { ToolRunError } from "../agent/executor";
import type { ToolPermission } from "../agent/permissions";
import type { CommerceDataSource } from "./data-source";

const addSchema = z.object({
  productId: z.string().min(1).max(80).describe("id sản phẩm đã tra cứu"),
  variantName: z.string().max(120).optional().describe("tên biến thể nếu khách chọn"),
  quantity: z.number().int().min(1).max(3).optional().describe("số lượng, mặc định 1"),
});

const watchSchema = z.object({
  productId: z.string().min(1).max(80).describe("id sản phẩm đã tra cứu"),
  email: z.string().email().max(200).describe("email nhận thông báo"),
  targetPrice: z.number().int().min(1000).max(1_000_000_000).describe("ngưỡng giá VND — báo khi giá bán ≤ mức này"),
});

function base64Key(prefix: string, id: string, extra = ""): string {
  // actionKey không mang nội dung nhạy cảm — chỉ để khớp khi duyệt.
  return `${prefix}:${Buffer.from(`${id}|${extra}`).toString("base64url").slice(0, 40)}`;
}


export function addToCartTool(source: CommerceDataSource): CommerceTool<typeof addSchema, unknown> {
  return {
    name: "add_to_cart",
    description:
      "Đề xuất thêm sản phẩm vào giỏ hàng của khách (kèm số lượng/biến thể). KHÔNG tự thêm — khách phải bấm duyệt. Chỉ gọi sau khi khách đồng ý mua.",
    permission: "cart" as ToolPermission,
    input: addSchema,
    prepareAction: (args, ctx) => {
      const key = base64Key("cart", args.productId, `${args.variantName ?? ""}|${args.quantity ?? 1}`);
      void ctx.persistAction?.({
        actionKey: key,
        tool: "add_to_cart",
        summary: `Thêm ${args.quantity ?? 1} × sản phẩm ${args.productId}${args.variantName ? ` (${args.variantName})` : ""} vào giỏ hàng`,
        data: { productId: args.productId, variantName: args.variantName, quantity: args.quantity ?? 1 },
      });
      return {
        actionKey: key,
        summary: `Thêm ${args.quantity ?? 1} món vào giỏ hàng`,
        data: { productId: args.productId, variantName: args.variantName, quantity: args.quantity ?? 1 },
      };
    },
    run: async (args) => {
      // Chỉ chạy khi đã duyệt — xác nhận sản phẩm còn tồn tại và mua được.
      const p = (await source.getProduct({ id: args.productId })) ?? (await source.getProduct({ slug: args.productId }));
      if (!p) throw new ToolRunError("not_found", "Sản phẩm không còn tồn tại trong kho.");
      if (p.availability === "out_of_stock" || p.stock <= 0) {
        throw new ToolRunError("unavailable", "Sản phẩm đã hết hàng nên không thêm được.");
      }
      // Giỏ là client state — trả payload cho widget thêm (server không ghi thay).
      return { added: true, productId: p.id, variantName: args.variantName, quantity: args.quantity ?? 1, clientApply: "add_to_cart" };
    },
  };
}

export function watchPriceTool(source: CommerceDataSource): CommerceTool<typeof watchSchema, unknown> {
  return {
    name: "watch_price",
    description:
      "Đăng ký theo dõi giá sản phẩm: khi giá bán giảm xuống ≤ ngưỡng khách chọn, hệ thống gửi email thông báo (chạy nền định kỳ). Khách duyệt một lần để tạo nhiệm vụ.",
    permission: "delegate" as ToolPermission,
    input: watchSchema,
    prepareAction: (args, ctx) => {
      const key = base64Key("watch", args.productId, String(args.targetPrice));
      void ctx.persistAction?.({
        actionKey: key,
        tool: "watch_price",
        summary: `Theo dõi giá sản phẩm ${args.productId}, báo email ${args.email.replace(/(.{2}).+(@.+)/, "$1…$2")} khi giảm xuống ≤ ${args.targetPrice.toLocaleString("vi-VN")}đ`,
        data: { productId: args.productId, email: args.email, targetPrice: args.targetPrice },
      });
      return {
        actionKey: key,
        summary: `Theo dõi giá, báo khi ≤ ${args.targetPrice.toLocaleString("vi-VN")}đ`,
        data: { productId: args.productId, email: args.email, targetPrice: args.targetPrice },
      };
    },
    run: async (args, ctx) => {
      const { prisma } = await import("@/lib/server/prisma");
      const p = (await source.getProduct({ id: args.productId })) ?? (await source.getProduct({ slug: args.productId }));
      if (!p) throw new ToolRunError("not_found", "Sản phẩm không tồn tại — không theo dõi được.");
      const sessionHash = ctx.rawSid ? (await import("@/lib/server/agent-session")).hashAgentSid(ctx.rawSid) : "anonymous";
      try {
        await prisma.priceWatch.upsert({
          where: { sessionHash_productId: { sessionHash, productId: p.id } },
          create: { sessionHash, email: args.email, productId: p.id, targetPrice: args.targetPrice, startPrice: p.price },
          update: { email: args.email, targetPrice: args.targetPrice, startPrice: p.price, status: "active", triggeredAt: null },
        });
      } catch {
        throw new ToolRunError("unavailable", "Không lưu được theo dõi giá. Thử lại sau.");
      }
      return {
        watching: true,
        product: p.name,
        startPrice: p.price,
        targetPrice: args.targetPrice,
        note: "Đã đăng ký theo dõi. Cron so giá định kỳ sẽ email khi giá xuống ngưỡng. Nhiệm vụ tự huỷ sau khi báo.",
      };
    },
  };
}
