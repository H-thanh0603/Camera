import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "@/lib/server/payments";

describe("payment webhook signature", () => {
  const secret = "test-secret-16-chars-min";
  const body = JSON.stringify({ provider: "vnpay", eventId: "e1", orderNumber: "LUM-1", amount: 1000, status: "paid", timestamp: 1 });

  it("verify đúng chữ ký tự tạo", () => {
    expect(verifyWebhookSignature(body, signWebhookPayload(body, secret), secret)).toBe(true);
  });

  it("từ chối body bị sửa", () => {
    const sig = signWebhookPayload(body, secret);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
  });

  it("từ chối secret sai", () => {
    const sig = signWebhookPayload(body, secret);
    expect(verifyWebhookSignature(body, sig, "secret-khac-hoan-toan-123")).toBe(false);
  });

  it("từ chối chữ ký rỗng / rác", () => {
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
    expect(verifyWebhookSignature(body, "not-hex", secret)).toBe(false);
  });
});
