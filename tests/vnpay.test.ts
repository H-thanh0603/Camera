import { describe, expect, it } from "vitest";
import {
  buildTxnRef,
  createVnpayPaymentUrl,
  formatVnpayDate,
  parseTxnRef,
  parseVnpayIpn,
  signVnpayParams,
  sortVnpayParams,
  verifyVnpaySignature,
  VNPAY_SANDBOX_URL,
} from "@/lib/server/vnpay";

const SECRET = "test-hash-secret-32-chars-minimum";
const CONFIG = {
  tmnCode: "TESTTMN1",
  hashSecret: SECRET,
  payUrl: VNPAY_SANDBOX_URL,
  returnUrl: "https://luminaoptics.vn/api/payments/vnpay-return",
};

function signedQuery(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const base: Record<string, string> = {
    vnp_Amount: "18500000000",
    vnp_BankCode: "NCB",
    vnp_Command: "pay",
    vnp_CreateDate: "20260911120000",
    vnp_CurrCode: "VND",
    vnp_IpAddr: "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: "Thanh toan don hang LUM-1",
    vnp_OrderType: "other",
    vnp_ReturnUrl: CONFIG.returnUrl,
    vnp_TmnCode: CONFIG.tmnCode,
    vnp_TxnRef: "LUM-1",
    vnp_Version: "2.1.0",
    vnp_ResponseCode: "00",
    vnp_TransactionNo: "14567890",
    ...overrides,
  };
  const sorted = sortVnpayParams(base);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete sorted[k];
    else sorted[k] = v;
  }
  const hash = signVnpayParams(sorted, SECRET);
  // Mô phỏng đường dây: VNPay redirect với query encode:false (dấu "+" nghĩa là space),
  // Next.js URLSearchParams parse "+" → space — verify phải ký lại khớp.
  const qs = Object.entries({ ...sorted, vnp_SecureHash: hash })
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const wire: Record<string, string> = {};
  new URLSearchParams(qs).forEach((v, k) => {
    wire[k] = v;
  });
  return wire;
}

describe("vnpay signature", () => {
  it("round-trip: ký URL rồi verify query parse lại", () => {
    const url = createVnpayPaymentUrl(CONFIG, {
      orderNumber: "LUM-99",
      amountVnd: 185_000_000,
      ipAddr: "127.0.0.1",
    });
    expect(url.startsWith(`${VNPAY_SANDBOX_URL}?`)).toBe(true);
    const query: Record<string, string> = {};
    new URL(url).searchParams.forEach((v, k) => {
      query[k] = v;
    });
    expect(query.vnp_Amount).toBe("18500000000");
    expect(query.vnp_TxnRef).toBe("LUM-99");
    expect(verifyVnpaySignature(query, SECRET)).toBe(true);
  });

  it("từ chối query bị sửa amount", () => {
    const q = signedQuery();
    expect(verifyVnpaySignature(q, SECRET)).toBe(true);
    expect(verifyVnpaySignature({ ...q, vnp_Amount: "100" }, SECRET)).toBe(false);
  });

  it("từ chối secret sai / thiếu hash", () => {
    const q = signedQuery();
    expect(verifyVnpaySignature(q, "secret-khac-hoan-toan-12345678")).toBe(false);
    const rest = { ...q };
    delete rest.vnp_SecureHash;
    expect(verifyVnpaySignature(rest, SECRET)).toBe(false);
  });

  it("orderInfo có dấu cách encode đúng chuẩn VNPay (+ thay %20)", () => {
    const sorted = sortVnpayParams({ vnp_OrderInfo: "Thanh toan don hang LUM-1" });
    expect(sorted.vnp_OrderInfo).toBe("Thanh+toan+don+hang+LUM-1");
  });
});

describe("vnpay txnRef retry", () => {
  it("build suffix duy nhất + parse ngược ra mã đơn", () => {
    const ref1 = buildTxnRef("LUM-ABC123", 1000);
    const ref2 = buildTxnRef("LUM-ABC123", 2000);
    expect(ref1).not.toBe(ref2);
    expect(parseTxnRef(ref1)).toBe("LUM-ABC123");
    expect(parseTxnRef("LUM-ABC123")).toBe("LUM-ABC123"); // ref cũ tương thích
  });
});

describe("vnpay date", () => {
  it("định dạng yyyyMMddHHmmss theo GMT+7", () => {
    // 2026-09-11T05:00:00Z = 12:00:00 GMT+7
    expect(formatVnpayDate(new Date("2026-09-11T05:00:00.000Z"))).toBe("20260911120000");
  });
});

describe("parseVnpayIpn", () => {
  it("IPN hợp lệ → txnRef + amount VND + responseCode", () => {
    const out = parseVnpayIpn(signedQuery(), SECRET);
    expect(out).toEqual({
      ok: true,
      txnRef: "LUM-1",
      amountVnd: 185_000_000,
      transactionNo: "14567890",
      responseCode: "00",
    });
  });

  it("sai checksum → 97", () => {
    const out = parseVnpayIpn({ ...signedQuery(), vnp_ResponseCode: "24" }, SECRET);
    expect(out).toEqual({ ok: false, code: "97", message: "Invalid signature" });
  });

  it("thiếu TxnRef / amount rác → 04", () => {
    expect(parseVnpayIpn(signedQuery({ vnp_TxnRef: undefined }), SECRET)).toMatchObject({ ok: false, code: "04" });
    expect(parseVnpayIpn(signedQuery({ vnp_Amount: "abc" }), SECRET)).toMatchObject({ ok: false, code: "04" });
  });
});
