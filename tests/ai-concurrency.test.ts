import { describe, expect, it, beforeEach } from "vitest";
import { __resetStreams, acquireStream } from "@/lib/ai/concurrency";

describe("concurrency gate (cap stream đồng thời/IP)", () => {
  beforeEach(() => {
    __resetStreams();
  });

  it("cho phép tới max rồi chặn, release mở lại chỗ", async () => {
    const a = await acquireStream("1.2.3.4", 2);
    expect(a.allowed).toBe(true);
    const b = await acquireStream("1.2.3.4", 2);
    expect(b.allowed).toBe(true);
    const c = await acquireStream("1.2.3.4", 2);
    expect(c.allowed).toBe(false);

    await a.release();
    const d = await acquireStream("1.2.3.4", 2);
    expect(d.allowed).toBe(true);
    await b.release();
    await d.release();
  });

  it("IP khác không ảnh hưởng lẫn nhau", async () => {
    const x = await acquireStream("1.2.3.4", 1);
    const y = await acquireStream("5.6.7.8", 1);
    expect(x.allowed).toBe(true);
    expect(y.allowed).toBe(true);
    await x.release();
    await y.release();
  });

  it("release idempotent — gọi hai lần không đếm âm", async () => {
    const a = await acquireStream("9.9.9.9", 1);
    await a.release();
    await a.release();
    const b = await acquireStream("9.9.9.9", 1);
    expect(b.allowed).toBe(true);
    await b.release();
  });

  it("slot bị từ chối không giữ chỗ", async () => {
    const a = await acquireStream("1.1.1.1", 1);
    const b = await acquireStream("1.1.1.1", 1);
    expect(b.allowed).toBe(false);
    // b bị từ chối tự release; chỉ còn a. Sau khi a release thì vào lại được.
    await a.release();
    const c = await acquireStream("1.1.1.1", 1);
    expect(c.allowed).toBe(true);
    await c.release();
  });
});
