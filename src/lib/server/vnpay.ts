import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * VNPay adapter — tạo URL thanh toán + verify chữ ký return/IPN.
 * Khớp sample chính thức của VNPay (Node.js): sort keys, encodeURIComponent
 * values (%20 → "+"), nối "k=v&...", HMAC-SHA512 bằng vnp_HashSecret.
 *
 * Không có keys (sandbox/prod) → route trả 503 fail-closed, user gắn keys sau.
 */

export const VNPAY_SANDBOX_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
export const VNPAY_VERSION = "2.1.0";

/**
 * vnp_TxnRef duy nhất mỗi lần bấm thanh toán: VNPay từ chối mã trùng khi
 * thanh toán lại. Hậu tố `__base36time` (mã đơn LUM-... không bao giờ chứa
 * "__" nên tách ngược an toàn). Ref cũ không hậu tố vẫn parse được.
 */
export function buildTxnRef(orderNumber: string, nowMs = Date.now()): string {
  return `${orderNumber}__${nowMs.toString(36)}`;
}

export function parseTxnRef(txnRef: string): string {
  const idx = txnRef.indexOf("__");
  return idx === -1 ? txnRef : txnRef.slice(0, idx);
}

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  /** Mặc định sandbox; production: https://www.vnpayment.vn/paymentv2/vpcpay.html */
  payUrl: string;
  /** URL tuyệt đối trỏ về /api/payments/vnpay-return */
  returnUrl: string;
}

export interface CreateVnpayUrlInput {
  /** Mã đơn LUM-... (duy nhất mỗi giao dịch). */
  orderNumber: string;
  /** Tổng tiền VND (đồng, số nguyên dương) — VNPay nhận amount*100. */
  amountVnd: number;
  /** IP của khách (vnp_IpAddr bắt buộc). */
  ipAddr: string;
  orderInfo?: string;
  /** Hạn thanh toán (phút), mặc định 15. */
  expireMinutes?: number;
  /** Mã ngân hàng (vnp_BankCode) — để trống cho user chọn trên VNPay. */
  bankCode?: string;
}

/** yyyyMMddHHmmss theo Asia/Ho_Chi_Minh (VNPay yêu cầu GMT+7). */
export function formatVnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

/** Sort + encode theo đúng sample VNPay (key sort, value encodeURIComponent, %20 → "+"). */
export function sortVnpayParams(params: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(params).sort()) {
    sorted[key] = encodeURIComponent(params[key]).replace(/%20/g, "+");
  }
  return sorted;
}

export function signVnpayParams(params: Record<string, string>, secret: string): string {
  const signData = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return createHmac("sha512", secret).update(signData, "utf-8").digest("hex");
}

/** Verify chữ ký VNPay (return + IPN): loại 2 trường hash, ký lại, so sánh an toàn. */
export function verifyVnpaySignature(query: Record<string, string | undefined>, secret: string): boolean {
  const received = query.vnp_SecureHash;
  if (!received || !secret) return false;
  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (k === "vnp_SecureHash" || k === "vnp_SecureHashType") continue;
    rest[k] = v;
  }
  const expected = signVnpayParams(sortVnpayParams(rest), secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createVnpayPaymentUrl(
  config: VnpayConfig,
  input: CreateVnpayUrlInput,
  now = new Date(),
): string {
  if (!Number.isInteger(input.amountVnd) || input.amountVnd <= 0) {
    throw new Error("Số tiền VNPay phải là số nguyên dương (VND).");
  }
  const createDate = formatVnpayDate(now);
  const expireDate = formatVnpayDate(new Date(now.getTime() + (input.expireMinutes ?? 15) * 60_000));
  const raw: Record<string, string> = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.orderNumber,
    vnp_OrderInfo: input.orderInfo ?? `Thanh toan don hang ${input.orderNumber}`,
    vnp_OrderType: "other",
    vnp_Amount: String(input.amountVnd * 100),
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  };
  if (input.bankCode) raw.vnp_BankCode = input.bankCode;
  const sorted = sortVnpayParams(raw);
  const secureHash = signVnpayParams(sorted, config.hashSecret);
  const query = Object.entries(sorted)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${config.payUrl}?${query}&vnp_SecureHash=${secureHash}`;
}

export type VnpayIpnOutcome =
  | { ok: true; txnRef: string; amountVnd: number; transactionNo: string; responseCode: string }
  | { ok: false; code: "97" | "01" | "04"; message: string };

/**
 * Parse + verify query IPN (pure, dễ test). Trả RspCode theo spec VNPay:
 * 97 sai checksum, 01 không tìm đơn (router check DB), 04 số tiền sai (router check DB).
 */
export function parseVnpayIpn(
  query: Record<string, string | undefined>,
  secret: string,
): VnpayIpnOutcome {
  if (!verifyVnpaySignature(query, secret)) {
    return { ok: false, code: "97", message: "Invalid signature" };
  }
  const txnRef = query.vnp_TxnRef ?? "";
  const amount = Number(query.vnp_Amount);
  if (!txnRef || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: "04", message: "Invalid amount" };
  }
  return {
    ok: true,
    txnRef,
    amountVnd: Math.round(amount / 100),
    transactionNo: query.vnp_TransactionNo ?? "",
    responseCode: query.vnp_ResponseCode ?? "",
  };
}
