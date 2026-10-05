/**
 * Quy tắc KM hiển thị dùng chung (card, PDP, JSON-LD priceValidUntil).
 * Sale chỉ "còn hiệu lực" khi có giá gạch (compareAt > price) VÀ
 * (không hẹn ngày hết hạn [legacy] HOẶC ngày còn trong tương lai).
 * Ngày rác → fail-closed (coi như hết KM) để không treo biển giảm giá sai.
 */
export function isSaleActive(
  item: { compareAtPrice?: number | null; saleEndsAt?: string | null },
  price: number,
  nowIso?: string,
): boolean {
  const compareAt = item.compareAtPrice ?? undefined;
  if (!compareAt || compareAt <= price) return false;
  const endsAt = item.saleEndsAt?.trim();
  if (!endsAt) return true;
  if (Number.isNaN(new Date(endsAt).getTime())) return false;
  return endsAt > (nowIso ?? new Date().toISOString());
}

/**
 * Ngày hết hạn (YYYY-MM-DD) để emit vào JSON-LD `priceValidUntil`.
 * Trả undefined khi KM không hiệu lực HOẶC là sale legacy không hẹn ngày
 * (không có ngày kết thúc thì không có gì để emit — không cast mù saleEndsAt).
 */
export function salePriceValidUntil(
  item: { compareAtPrice?: number | null; saleEndsAt?: string | null },
  price: number,
  nowIso?: string,
): string | undefined {
  if (!isSaleActive(item, price, nowIso)) return undefined;
  const endsAt = item.saleEndsAt?.trim();
  return endsAt ? endsAt.slice(0, 10) : undefined;
}

/** Số ngày còn lại của KM (null khi không có KM hiệu lực). */
export function saleDaysLeft(
  item: { compareAtPrice?: number | null; saleEndsAt?: string | null },
  price: number,
  nowMs = Date.now(),
): number | null {
  if (!isSaleActive(item, price, new Date(nowMs).toISOString())) return null;
  const end = new Date(item.saleEndsAt as string).getTime();
  return Math.max(1, Math.ceil((end - nowMs) / 86_400_000));
}
