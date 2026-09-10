import type { Carrier } from "@/lib/types";

/**
 * Vận chuyển — abstraction thay thế được.
 * Hiện tại: `manual` (concierge tạo đơn tay trên GHN/GHTK rồi nhập mã vận
 * đơn vào admin). Khi có API key, implement ShipperAdapter cho GHN/GHTK
 * theo docs/shipping-integration.md rồi đấu vào createShipment().
 */

export const CARRIERS: { value: Carrier; label: string }[] = [
  { value: "manual", label: "Tự bàn giao" },
  { value: "ghn", label: "GHN" },
  { value: "ghtk", label: "GHTK" },
];

export function isCarrier(value: unknown): value is Carrier {
  return value === "manual" || value === "ghn" || value === "ghtk";
}

/** Mã vận đơn: chữ số/chữ in hoa/gạch nối, 4–64 ký tự. */
export function isTrackingCode(value: string): boolean {
  return /^[A-Za-z0-9-]{4,64}$/.test(value.trim());
}

export interface ShipperStatus {
  carrier: Carrier;
  /** true khi đã cấu hình API key — tạo vận đơn tự động được. */
  apiReady: boolean;
}

export function shipperStatuses(): ShipperStatus[] {
  const ghn = Boolean(process.env.GHN_TOKEN && process.env.GHN_SHOP_ID);
  const ghtk = Boolean(process.env.GHTK_TOKEN);
  return [
    { carrier: "manual", apiReady: true },
    { carrier: "ghn", apiReady: ghn },
    { carrier: "ghtk", apiReady: ghtk },
  ];
}

export interface ShipperAdapter {
  readonly carrier: Exclude<Carrier, "manual">;
  createShipment(input: { orderNumber: string; toName: string; toPhone: string; toAddress: string; codAmount: number }): Promise<{ trackingCode: string }>;
}

/** Đăng ký adapter thật ở đây khi có API key (throw nếu chưa cấu hình). */
export function getShipperAdapter(carrier: Exclude<Carrier, "manual">): ShipperAdapter {
  throw new Error(
    `Chưa cấu hình adapter ${carrier} — nhập mã vận đơn tay ở admin (xem docs/shipping-integration.md).`,
  );
}
