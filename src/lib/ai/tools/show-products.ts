/**
 * UI tool — `show_products`: agent kết thúc tư vấn bằng cách HIỂN THỊ card
 * sản phẩm thật trong widget (ảnh, giá, tồn kho, nút xem/thêm giỏ).
 *
 * Đây là "UI action" duy nhất agent được phát — vẫn không viết vào đơn/giỏ
 * (web lo việc đó qua nút của card). Payload card được validate chặt: chỉ
 * sản phẩm tồn tại trong data source mới ra card, mọi URL/ảnh lấy từ DB
 * chứ không từ model.
 */

import { z } from "zod";
import type { CommerceTool } from "../agent/executor";
import { ToolRunError } from "../agent/executor";
import type { CommerceDataSource } from "./data-source";

const showSchema = z.object({
  productRefs: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(6)
    .describe("id hoặc slug của sản phẩm để hiển thị card (đã tra cứu trước đó)"),
});

/** Card payload tới client — mọi trường render an toàn, không markdown tự do. */
export interface ProductCardPayload {
  id: string;
  slug: string;
  name: string;
  brand: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  priceVND: number;
  compareAtPriceVND?: number;
  availability: string;
  stock: number;
  rating: number;
  reviewCount: number;
}

export function showProductsTool(source: CommerceDataSource): CommerceTool<typeof showSchema, { cards: ProductCardPayload[] }> {
  return {
    name: "show_products",
    description:
      "Hiển thị card sản phẩm (ảnh, giá, nút xem/thêm giỏ) ngay trong chat sau khi đã tra cứu. Gọi khi đã có danh sách sản phẩm phù hợp để khách bấm ngay, không cần gõ lại tên. Tối đa 6 card/lượt.",
    input: showSchema,
    run: async (args) => {
      const refs = [...new Set(args.productRefs)];
      const cards: ProductCardPayload[] = [];
      const missing: string[] = [];
      for (const ref of refs) {
        // Model truyền lẫn id và slug — thử cả hai đường, không heuristic.
        const p = (await source.getProduct({ id: ref })) ?? (await source.getProduct({ slug: ref }));
        if (!p) {
          missing.push(ref);
          continue;
        }
        cards.push({
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          thumbnailUrl: p.thumbnail.url,
          thumbnailAlt: p.thumbnail.alt,
          priceVND: p.price,
          compareAtPriceVND: p.compareAtPrice ?? undefined,
          availability: p.availability,
          stock: p.stock,
          rating: p.rating,
          reviewCount: p.reviewCount,
        });
      }
      if (cards.length === 0) {
        throw new ToolRunError("not_found", `Không tìm thấy sản phẩm nào trong: ${missing.join(", ")}`);
      }
      // Model nhận kết quả text — card thật đi qua sự kiện UI, không vào prompt.
      return {
        cards,
        note: "Đã hiển thị card cho khách. Không lặp lại toàn bộ thông tin sản phẩm trong câu trả lời — chỉ tóm tắt lý do nên mua.",
        ...(missing.length > 0 ? { missing: `Không hiển thị được: ${missing.join(", ")}` } : {}),
      };
    },
  };
}
