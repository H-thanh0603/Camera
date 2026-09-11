import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/server/env";
import { verifyVnpaySignature } from "@/lib/server/vnpay";

/**
 * GET /api/payments/vnpay-return — user redirect về từ VNPay sau thanh toán.
 * Verify chữ ký rồi chuyển về /account kèm kết quả (trạng thái chuẩn vẫn do
 * IPN server-to-server quyết định — return URL chỉ để hiển thị).
 */
export async function GET(request: NextRequest) {
  const siteUrl =
    getEnv().NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";
  const query: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  const order = query.vnp_TxnRef ?? "";
  let result = "invalid";
  try {
    const secret = getEnv().VNPAY_HASH_SECRET;
    if (secret && verifyVnpaySignature(query, secret)) {
      result = query.vnp_ResponseCode === "00" ? "success" : "failed";
    }
  } catch {
    result = "invalid";
  }
  const url = new URL("/account", siteUrl);
  url.searchParams.set("pay", "vnpay");
  if (order) url.searchParams.set("order", order);
  url.searchParams.set("result", result);
  return NextResponse.redirect(url);
}
