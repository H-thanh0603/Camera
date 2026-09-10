import { describe, expect, it, vi } from "vitest";
import { isSameOriginRequest } from "@/lib/csrf";

const { currentToken } = vi.hoisted(() => ({ currentToken: { value: undefined as string | undefined } }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "lumina.session" && currentToken.value ? { value: currentToken.value } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { getSessionUser, hashToken, revokeUserSessions } = await import("@/lib/server/session");

function req(method: string, url: string, headers: Record<string, string> = {}) {
  return { method, url, headers: new Headers(headers) };
}

describe("CSRF same-origin check", () => {
  const URL = "https://shop.lumina.vn/api/orders";
  it("GET luôn pass", () => {
    expect(isSameOriginRequest(req("GET", URL))).toBe(true);
  });
  it("POST cùng Origin pass, khác Origin chặn", () => {
    expect(isSameOriginRequest(req("POST", URL, { origin: "https://shop.lumina.vn" }))).toBe(true);
    expect(isSameOriginRequest(req("POST", URL, { origin: "https://evil.test" }))).toBe(false);
  });
  it("vắng Origin thì kiểm Referer; vắng cả hai thì chặn", () => {
    expect(isSameOriginRequest(req("POST", URL, { referer: "https://shop.lumina.vn/checkout" }))).toBe(true);
    expect(isSameOriginRequest(req("POST", URL, { referer: "https://evil.test/x" }))).toBe(false);
    expect(isSameOriginRequest(req("POST", URL))).toBe(false);
  });
});

describe("session sliding + absolute cap + revoke", () => {
  const EMAIL = "sess-test@t.vn";

  it("gia hạn sliding khi còn dưới nửa TTL; quá trần 90 ngày thì đá", async () => {
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: {},
      create: { email: EMAIL, name: "Sess", passwordHash: "x" },
    });
    const { randomBytes } = await import("node:crypto");
    const raw = randomBytes(32).toString("hex");
    // Phiên gần hết hạn (còn 1 ngày < nửa TTL 15 ngày)
    await prisma.session.create({
      data: { tokenHash: hashToken(raw), userId: user.id, expiresAt: new Date(Date.now() + 24 * 3600_000) },
    });
    currentToken.value = raw;
    const found = await getSessionUser();
    expect(found?.email).toBe(EMAIL);
    const refreshed = await prisma.session.findUnique({ where: { tokenHash: hashToken(raw) } });
    // Đã gia hạn ≈ 30 ngày
    expect(refreshed!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 3600_000);

    // Phiên quá trần tuyệt đối (tạo 100 ngày trước) → đá
    const raw2 = randomBytes(32).toString("hex");
    const old = await prisma.session.create({
      data: { tokenHash: hashToken(raw2), userId: user.id, expiresAt: new Date(Date.now() + 29 * 24 * 3600_000) },
    });
    await prisma.session.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 100 * 24 * 3600_000) },
    });
    currentToken.value = raw2;
    expect(await getSessionUser()).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: old.id } })).toBeNull();

    // Revoke đá hết phiên còn lại
    const revoked = await revokeUserSessions(user.id);
    expect(revoked).toBeGreaterThanOrEqual(1);
    await prisma.user.delete({ where: { id: user.id } });
    currentToken.value = undefined;
  });
});
