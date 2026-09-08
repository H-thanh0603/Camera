# Phase 2.4 — BullMQ/Upstash Queue Migration

> ✅ IMPLEMENTED (biến thể Redis-list, KHÔNG BullMQ): `src/lib/server/email-queue.ts`,
> `scripts/email-worker.ts`, `GET /api/admin/queue`, `tests/email-queue.test.ts`.
> Lý do bỏ BullMQ: BullMQ cần TCP persistent, Upstash REST (HTTP) không hỗ trợ —
> queue tự cài trên list+zset đủ cho email (pending/delayed-backoff/dead).
> Chưa làm: order-event queue, scheduled jobs (abandoned cart), QStash.

## Trigger
Khi cần background jobs đáng tin: email async, payment webhook processing,
order status updates, inventory sync, retry logic, hoặc scheduled tasks
ngoài cron đơn giản.

## Trạng thái hiện tại
- **Email**: Inline trong `placeOrder` + `passwordReset` — `await sendEmail()`
  thất bại thì log warning, user không nhận mail nhưng order vẫn tạo
- **Webhook**: `POST /api/payments/webhook` — synchronous,Prisma transaction
- **Cron**: `scripts/db-sweep.mjs`, `scripts/db-backup.mjs` — system cron
- **No retry**: Email failures = permanent loss
- **No delay**: Coupon release instant (ok cho now)

## Mục tiêu
- Async email: queue → worker → send (retry 3x, backoff)
- Background jobs: order confirmation, password reset, review notifications
- Delayed jobs: scheduled reminders, abandoned cart
- Monitoring: job status, failure alerts

## Implementation

### 1. Infrastructure
```
Upstash Redis (existing rate-limit) + BullMQ
├── Queues
│   ├── email         (email sending)
│   ├── order-events  (confirmation, status change)
│   └── webhooks      (payment processing)
├── Workers
│   ├── email-worker.ts
│   ├── order-worker.ts
│   └── webhook-worker.ts
```

### 2. Environment variables
```env
# Already have for rate-limit
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx

# New: Queue-specific
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=3
```

### 3. Code changes

**New: `src/lib/server/queue.ts`**
```typescript
import { Queue, Worker } from "bullmq";
import { Redis } from "@upstash/redis";

const connection = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const emailQueue = new Queue("email", { connection });
export const orderQueue = new Queue("order-events", { connection });

// Email worker
const emailWorker = new Worker("email", async (job) => {
  const { to, subject, html } = job.data;
  await sendEmail({ to, subject, html });
}, { connection, concurrency: 5 });

emailWorker.on("failed", (job, err) => {
  logger.error("email.job.failed", { jobId: job?.id, error: err.message });
});
```

**Modified: `src/lib/server/place-order.ts`**
```typescript
// Before: await sendEmail({ to, subject, html });
// After:
await emailQueue.add("order-confirmation", {
  to: customerEmail,
  subject: `LUMINA — Đơn hàng #${order.number}`,
  html: orderConfirmationHtml(order),
}, {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: true,
});
```

**Modified: `src/lib/server/password-reset.ts`**
```typescript
// Queue password reset email instead of inline
await emailQueue.add("password-reset", {
  to: email,
  subject: "LUMINA — Đặt lại mật khẩu",
  html: passwordResetHtml(token),
}, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
```

### 4. Worker deployment
```
# Option A: Separate process (production)
node dist/workers/email-worker.js

# Option B: Next.js API route with BullMQ (simpler)
// src/app/api/workers/route.ts — NOT recommended for prod

# Option C: Upstash QStash (serverless, recommended)
// Managed queue, no worker process needed
```

### 5. Monitoring
```typescript
// Health check endpoint
GET /api/health/queues
→ { email: { waiting: 2, active: 1, failed: 0 }, ... }
```

### 6. Migration strategy
1. **Phase A**: Queue + worker setup (non-breaking, emails still inline)
2. **Phase B**: Switch email to queue (placeOrder, passwordReset)
3. **Phase C**: Add order-event queue (confirmation, status change)
4. **Phase D**: Scheduled jobs (abandoned cart, review reminders)

## Rollback
- Queue failures → emails stop (no data loss, just delay)
- Fallback: `try { await emailQueue.add(...) } catch { await sendEmail(...) }`
- Worker crashes → jobs stay in Redis, restart worker

## Effort
~3-4 ngày: Queue setup, worker deployment, email migration, monitoring.

## Files affected
- `src/lib/server/queue.ts` — new (queue + worker)
- `src/lib/server/place-order.ts` — email → queue
- `src/lib/server/password-reset.ts` — email → queue
- `src/lib/server/email.ts` — sendEmail stay (used by worker)
- `src/app/api/health/queue/route.ts` — new (monitoring)
- `package.json` — add `bullmq` dependency
- `docker-compose.yml` — worker service (if self-hosted Redis)
