import type { Product, Recommendation, RecommendationReason } from "@/lib/types";
import { getCatalog, getProductById } from "@/lib/repositories/product-repository";

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

export function getSimilarProducts(product: Product, limit = 4, catalog: Product[] = getCatalog()): Recommendation[] {
  return catalog.filter(
    (p) =>
      p.id !== product.id &&
      (p.category === product.category ||
        p.tags.some((t) => product.tags.includes(t) && t !== "camera" && t !== "lens")),
  )
    .sort(
      (a: Product, b: Product) =>
        (b.brand === product.brand ? 1 : 0) +
        (b.category === product.category ? 1 : 0) -
        (a.brand === product.brand ? 1 : 0) -
        (a.category === product.category ? 1 : 0) ||
        Math.abs(a.price - product.price) - Math.abs(b.price - product.price),
    )
    .slice(0, limit)
    .map((p) => ({
      product: p,
      reason: p.brand === product.brand ? "same_brand" : "similar",
      label: "You may also like",
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

export function getTrending(limit = 4, catalog: Product[] = getCatalog()): Recommendation[] {
  return [...catalog]
    .filter((p) => p.reviewCount > 0)
    .sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount)
    .slice(0, limit)
    .map((p) => ({ product: p, reason: "trending" as const, label: "Recommended for you" }));
}
