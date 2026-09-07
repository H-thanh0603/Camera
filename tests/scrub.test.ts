import { describe, expect, it } from "vitest";
import { hashId, scrubMeta } from "@/lib/server/scrub";

describe("scrub PII", () => {
  it("che email/SĐT trong string", () => {
    const out = scrubMeta({ msg: "liên hệ nguyenvana@gmail.com hoặc 0901234567" }) as Record<string, string>;
    expect(out.msg).not.toContain("nguyenvana@gmail.com");
    expect(out.msg).not.toContain("0901234567");
    expect(out.msg).toContain("@gmail.com");
  });

  it("redact key nhạy cảm + PII key", () => {
    const out = scrubMeta({
      passwordHash: "scrypt$abc",
      token: "xyz",
      email: "a@b.co",
      address: "123 Đường X",
      name: "Máy ảnh Lumina",
      total: 1000,
    }) as Record<string, unknown>;
    expect(out.passwordHash).toBe("[REDACTED]");
    expect(out.token).toBe("[REDACTED]");
    expect(out.email).not.toBe("a@b.co");
    expect(out.address).toBe("[REDACTED]");
    expect(out.name).toBe("Máy ảnh Lumina");
    expect(out.total).toBe(1000);
  });

  it("đệ quy mảng/object lồng nhau", () => {
    const out = scrubMeta({ contact: { email: "x@y.vn", phone: "0912345678" }, tags: ["a@b.co"] }) as {
      contact: { email: string; phone: string };
      tags: string[];
    };
    expect(out.contact.email).not.toContain("x@y.vn");
    expect(out.contact.phone).not.toContain("0912345678");
    expect(out.tags[0]).not.toBe("a@b.co");
  });

  it("hashId ổn định và không lộ giá trị", () => {
    expect(hashId("a@b.co")).toBe(hashId("a@b.co"));
    expect(hashId("a@b.co")).not.toContain("a@b.co");
  });
});
