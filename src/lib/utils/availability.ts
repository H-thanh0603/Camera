import type { Availability } from "@/lib/types";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "Còn hàng",
  low_stock: "Sắp hết — còn ít",
  pre_order: "Đặt trước",
  out_of_stock: "Tạm hết hàng",
  contact: "Liên hệ Concierge",
};

export const AVAILABILITY_CLASS: Record<Availability, string> = {
  in_stock: "text-primary",
  low_stock: "text-secondary",
  pre_order: "text-tertiary",
  out_of_stock: "text-error",
  contact: "text-on-surface-variant",
};

export function canPurchase(availability: Availability): boolean {
  return availability === "in_stock" || availability === "low_stock";
}
