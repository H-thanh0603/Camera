import { describe, expect, test } from "vitest";
import {
  EMAIL_MAX_ATTEMPTS,
  backoffDelayMs,
  emailQueueDepths,
  enqueueEmail,
  processOneEmailJob,
  type QueueRedis,
} from "@/lib/server/email-queue";

/** Fake Redis in-memory cho test (không cần UPSTASH_*). */
function createFake(): QueueRedis & { lists: Map<string, string[]>; zsets: Map<string, { score: number; member: string }[]> } {
  const lists = new Map<string, string[]>();
  const zsets = new Map<string, { score: number; member: string }[]>();
  return {
    lists,
    zsets,
    lpush: async (k, v) => {
      const l = lists.get(k) ?? [];
      l.unshift(v);
      lists.set(k, l);
    },
    rpop: async (k) => lists.get(k)?.pop() ?? null,
    zadd: async (k, score, member) => {
      const z = zsets.get(k) ?? [];
      z.push({ score, member });
      zsets.set(k, z);
    },
    zrangebyscore: async (k, min, max) =>
      (zsets.get(k) ?? []).filter((e) => e.score >= min && e.score <= max).map((e) => e.member),
    zrem: async (k, member) => {
      zsets.set(k, (zsets.get(k) ?? []).filter((e) => e.member !== member));
    },
    llen: async (k) => lists.get(k)?.length ?? 0,
    zcard: async (k) => zsets.get(k)?.length ?? 0,
  };
}

describe("backoffDelayMs", () => {
  test("exponential 5s → 10s → 20s", () => {
    expect(backoffDelayMs(1)).toBe(5000);
    expect(backoffDelayMs(2)).toBe(10000);
    expect(backoffDelayMs(3)).toBe(20000);
  });
});

describe("enqueueEmail", () => {
  test("null redis → queued:false, không throw", async () => {
    await expect(
      enqueueEmail(null, { kind: "t", to: "a@b.c", subject: "s", html: "h" }),
    ).resolves.toEqual({ queued: false });
  });
  test("enqueue thành công sinh id", async () => {
    const fake = createFake();
    const res = await enqueueEmail(fake, { kind: "t", to: "a@b.c", subject: "s", html: "h" });
    expect(res.queued).toBe(true);
    expect(res.id).toBeTruthy();
    expect(await emailQueueDepths(fake)).toEqual({ pending: 1, delayed: 0, dead: 0 });
  });
});

describe("processOneEmailJob", () => {
  test("gửi thành công → sent", async () => {
    const fake = createFake();
    await enqueueEmail(fake, { kind: "t", to: "a@b.c", subject: "s", html: "h" });
    const res = await processOneEmailJob(fake, async () => ({ sent: true }), 1000);
    expect(res).toBe("sent");
    expect(await emailQueueDepths(fake)).toEqual({ pending: 0, delayed: 0, dead: 0 });
  });
  test("fail → retry delayed với backoff, đủ 3 lần → dead", async () => {
    const fake = createFake();
    await enqueueEmail(fake, { kind: "t", to: "a@b.c", subject: "s", html: "h" });
    const fail = async () => ({ sent: false });
    let now = 1000;
    for (let i = 1; i < EMAIL_MAX_ATTEMPTS; i++) {
      expect(await processOneEmailJob(fake, fail, now)).toBe("retry");
      const depths = await emailQueueDepths(fake);
      expect(depths).toEqual({ pending: 0, delayed: 1, dead: 0 });
      now += backoffDelayMs(i) + 1; // tới hạn retry
    }
    expect(await processOneEmailJob(fake, fail, now)).toBe("dead");
    expect(await emailQueueDepths(fake)).toEqual({ pending: 0, delayed: 0, dead: 1 });
  });
  test("send throw → tính như fail, không throw ra ngoài", async () => {
    const fake = createFake();
    await enqueueEmail(fake, { kind: "t", to: "a@b.c", subject: "s", html: "h" });
    await expect(
      processOneEmailJob(fake, async () => { throw new Error("smtp down"); }, 1000),
    ).resolves.toBe("retry");
  });
  test("queue rỗng → empty", async () => {
    expect(await processOneEmailJob(createFake(), async () => ({ sent: true }), 1000)).toBe("empty");
  });
  test("job malformed → bỏ qua, không kẹt", async () => {
    const fake = createFake();
    await fake.lpush("lumina:queue:email:pending", "not-json{{{");
    expect(await processOneEmailJob(fake, async () => ({ sent: true }), 1000)).toBe("empty");
    expect((await emailQueueDepths(fake)).pending).toBe(0);
  });
});
