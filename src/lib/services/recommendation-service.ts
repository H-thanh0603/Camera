import type { Product, Recommendation, RecommendationReason } from "@/lib/types";
import { getProductById } from "@/lib/repositories/product-repository";

/**
 * RecommendationService — gợi ý dựa trên dữ liệu có sẵn trên client
 * (recently viewed, wishlist, cart, cùng category/brand, sản phẩm đi kèm).
 * Interface cố tình giống một recommendation engine: sau này thay bằng
 * API/AI chỉ cần đổi thân hàm.
 */

export function getCompleteSetup(product: Product, limit = 4): Recommendation[] {
  return (product.compatibleWith ?? [])
    .map((id) => getProductById(id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, limit)
    .map((p) => ({
      product: p,
      reason: "complete_setup" as RecommendationReason,
      label: "Complete your setup",
    }));
}

export function getFromHistory(historyIds: string[], limit = 4): Recommendation[] {
  return historyIds
    .filter((id) => !historyIds.slice(0, historyIds.indexOf(id)).includes(id)) // de-dup giữ lần xem gần nhất
    .reverse()
    .map((id) => getProductById(id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, limit)
    .map((p) => ({
      product: p,
      reason: "recently_viewed" as RecommendationReason,
      label: "Recently viewed",
    }));
}
