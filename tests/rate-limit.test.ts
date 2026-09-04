import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/utils/rate-limit";

describe("rate limiter (fixed window)", () => {
  it("cho phép tới đúng max request trong cửa sổ", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 3 });
    expect(limiter.check("ip1", 0).allowed).toBe(true);
    expect(limiter.check("ip1", 1).allowed).toBe(true);
    expect(limiter.check("ip1", 2).allowed).toBe(true);
    expect(limiter.check("ip1", 3)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("đếm độc lập theo key", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1 });
    expect(limiter.check("ip1", 0).allowed).toBe(true);
    expect(limiter.check("ip2", 0).allowed).toBe(true);
    expect(limiter.check("ip1", 1).allowed).toBe(false);
  });

  it("retryAfterSeconds phản ánh thời gian còn lại của cửa sổ", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1 });
    limiter.check("ip1", 0);
    const blocked = limiter.check("ip1", 4_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(6);
  });

  it("mở lại cửa sổ mới sau windowMs", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 2 });
    limiter.check("ip1", 0);
    limiter.check("ip1", 1);
    expect(limiter.check("ip1", 2).allowed).toBe(false);
    expect(limiter.check("ip1", 10_000)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("reset xóa toàn bộ state", () => {
    const limiter = createRateLimiter({ windowMs: 10_000, max: 1 });
    limiter.check("ip1", 0);
    limiter.reset();
    expect(limiter.check("ip1", 0).allowed).toBe(true);
  });
});
