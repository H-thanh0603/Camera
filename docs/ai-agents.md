# Lumina Commerce Agent — provider-agnostic AI shopping assistant

Tích hợp có chọn lọc **Commerce Agents** (shopping-agent: tool executor, fencing,
backend, streaming, checkout handoff) vào LUMINA Optics — **không hard-code
Anthropic**. Mọi model đều chạy qua `AIProvider`; đổi provider/model chỉ bằng env.

## 1. Kiến trúc

```text
Frontend chat widget (components/agent/shopping-assistant.tsx)
  │  POST /api/agent/chat (SSE, không API key) + bối cảnh trang/giỏ
  ▼
Commerce Agent (src/lib/ai/agent/runtime.ts — độc lập provider)
  │  tool calls (Agent → ToolExecutor: failure ladder, zod validate)
  │  show_products → event 'cards' → widget render card + nút mua
  ▼
Commerce tools (search/details/compare/recommend/price/availability/categories/top/show)
  │  qua CommerceDataSource (seed | db) — tái dùng product-db + services có sẵn
  ▼
AgentRuntime → AIProvider → Provider adapter → LLM
History: cookie agent_sid (httpOnly) → AgentSession DB (SHA-256, TTL 30 ngày)
Hành động: add_to_cart/watch_price → AgentAction pending → user duyệt → chạy
```

Thư mục `src/lib/ai/`:

| File | Vai trò |
|---|---|
| `types.ts` | Interface `AIProvider`, messages, capabilities, ra/vào chuẩn |
| `errors.ts` | Lỗi provider-agnostic (`auth`, `rate_limited`, `timeout`, `unavailable`, …) |
| `config.ts` | Đọc env (lazy, optional), chuỗi fallback |
| `providers/factory.ts` | Tạo adapter theo tên provider |
| `providers/openai-compatible.ts` | 1 adapter cho OpenAI / OpenRouter / TokenRouter / DeepSeek / Gemini (OpenAI-compatible endpoint) |
| `providers/anthropic.ts` | Messages API (`tool_use` + SSE) |
| `agent/runtime.ts` | Vòng lặp agent (chat + stream), log observability |
| `agent/executor.ts` | Dispatch tool + failure ladder (invalid → domain → system) |
| `agent/fencing.ts` | Sanitize dữ liệu sản phẩm chống prompt injection |
| `agent/prompts.ts` | System prompt Lumina (tiếng Việt, grounding rules) |
| `tools/*` | 8 commerce tools + 2 data source (`seed`, `db`) |
| `fallback.ts` | Fallback: lỗi trước khi stream → thử provider tiếp theo (hữu hạn, không loop) |
| `budget.ts` | Đếm token tháng + kill-switch `AI_MONTHLY_TOKEN_CAP` (Redis/in-memory) |
| `concurrency.ts` | Cap số stream đồng thời/IP (`AI_MAX_CONCURRENT_STREAMS`) |
| `structured.ts` | Structured output qua tool-forcing / JSON fallback |

## 2. Provider được hỗ trợ

| Provider | Adapter | Ghi chú |
|---|---|---|
| `anthropic` | Messages API | vision/reasoning mặc định bật |
| `openai` | OpenAI-compatible | base `api.openai.com/v1` |
| `openrouter` | OpenAI-compatible | `HTTP-Referer` tự gắn |
| `tokenrouter` | OpenAI-compatible | base `tokenrouter.ai/api/v1` |
| `deepseek` | OpenAI-compatible | base `api.deepseek.com/v1` |
| `gemini` | OpenAI-compatible | qua `generativelanguage…/v1beta/openai` |

Thêm provider **không sửa agent logic**: thêm preset trong `PROVIDER_PRESETS`
(`config.ts`) + case trong `factory.ts` (nếu không OpenAI-compatible).

## 3. Cấu hình

`.env` (xem `.env.example`, **key chỉ ở server, không bao giờ ra frontend**):

```env
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-sonnet-4
OPENROUTER_API_KEY=sk-or-...
```

Đổi provider/model **không sửa code**:

```env
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat
```

Fallback có thứ tự, hữu hạn (primary → từng fallback, dừng ở provider đầu tiên
stream được; sau khi text đã gửi thì commit, không đổi giữa chừng):

```env
AI_FALLBACKS="provider=deepseek&model=deepseek-chat;provider=openai&model=gpt-4o-mini"
```

Khác: `AI_API_KEY` (key chung), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`TOKENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_API_KEY` (gemini),
`AI_TEMPERATURE`, `AI_MAX_TOKENS` (mặc định 1024/turn), `AI_TIMEOUT_MS`,
`AI_MAX_ITERATIONS` (mặc định 6), `AI_MONTHLY_TOKEN_CAP`,
`AI_MAX_CONCURRENT_STREAMS` (mặc định 3).
Thiếu key → `/api/agent/chat` trả 503 thân thiện, app còn lại vẫn chạy.

### 3.1 Kiểm soát chi phí (vận hành thực tế)

- `AI_MONTHLY_TOKEN_CAP` — kill-switch: vượt cap tháng → route trả 503
  "tạm ngừng do vượt hạn mức", log `agent.budget_exceeded`. Đặt `0`/bỏ trống
  = không giới hạn. Khi dùng ≥80% log `agent.budget_near_limit` để alert.
- Đếm token qua event `usage` tổng hợp cả mọi iteration; ghi vào
  `agent.completed` kèm `requestTokens` + `monthTotalTokens`.
- Cần `UPSTASH_REDIS_*` để đếm đúng khi chạy nhiều instance; fallback
  in-memory fail-open (mất đếm khi restart — chấp nhận được).
- Mỗi turn bị `maxTokens` 1024 chặn + tối đa 5 tool calls/turn +
  `maxIterations` 6 → worst-case mỗi request là hữu hạn và tính trước được.

### 3.2 Giới hạn luồng (rate/concurrency)

- 10 request/phút/IP (rate-limit POST).
- Tối đa `AI_MAX_CONCURRENT_STREAMS` (default 3) stream đang mở/IP —
  mỗi stream giữ 1 connection + LLM call tới 120s. Vượt → 429, log
  `agent.stream_limit`. Slot giải phóng ở `finally` lẫn `cancel()`
  (idempotent), Redis TTL 3 phút tự dọn nếu process chết.

### 3.3 Vận hành /health và feedback

- `GET /api/agent/health` — cho uptime-monitor: `status`
  (`ok|unconfigured|no_provider|budget_exhausted`), provider/model, số
  fallback, token tháng đã dùng/cap, `redisConfigured`. Không gọi LLM.
- `POST /api/agent/feedback` — widget gửi 👍👎 kèm `requestId` + snippet
  ≤280 ký tự, log `agent.feedback`. Trace về request gốc qua `X-Request-Id`
  trong `agent.completed` / `tool.dispatch`.

## 4. Thêm commerce tool mới

1. Định nghĩa zod schema + `CommerceTool` trong `src/lib/ai/tools/` (xem
   `commerce-tools.ts`), chỉ đọc từ `CommerceDataSource`.
2. Thêm vào `createCommerceTools()` / `compare-recommend.ts` (test sẽ bắt nếu thiếu).
3. Runtime tự expose qua `executor.specs()` cho mọi provider — **không cần
   viết lại schema theo vendor**.

Quy tắc: tool mặc định **read-only**. Ba ngoại lệ ghi — `add_to_cart`,
`watch_price` — đều **phải qua user approval** (prepareAction → AgentAction
pending TTL 10 phút → user bấm Duyệt → mới chạy), khai báo `permission` và
bị executor lọc theo policy (guest/admin). `check_shipping_fee` là tool
external-service (GHN API, cache Redis 1h). Checkout vẫn của web — agent
không tạo/huỷ đơn, không thanh toán.

## 5. Bảo mật

- Key server-only; frontend chỉ gọi `/api/agent/chat`.
- `fenceText`/`fenceProduct`: làm sạch mô tả/tag/review trước khi vào prompt;
  kết quả tool bọc `<tool-data>` và coi như dữ liệu.
- **History từ client được fence ở cả hai role** (user lẫn assistant) —
  client độc hại không thể nhúng chỉ thị giả vai "assistant" vào history;
  system prompt cũng khai báo history là dữ liệu client gửi, không tin cậy.
- **History lưu server-side** (bảng `AgentSession`): cookie `agent_sid`
  httpOnly, DB chỉ lưu SHA-256; nội dung fence trước khi ghi, ≤40 tin,
  TTL 30 ngày (dọn bởi `scripts/db-sweep.ts`). Nút "hội thoại mới" gọi
  `POST /api/agent/reset` xoá cả DB row lẫn cookie.
- Tool JSON truncate theo phần tử mảng — model luôn nhận JSON parse được.
- Validate args bằng zod; lỗi hệ thống trả generic (không lộ stack/internal).
- Rate-limit 10 req/phút/IP; message ≤2000 ký tự; history ≤20 turns;
  ≤5 tool calls mỗi model turn; ≤3 stream đồng thời/IP.
- Engine ghi log requestId/provider/model/tool/latency/usage — **không log key**.

## 6. Chạy & kiểm thử

```bash
npx vitest run tests/ai-providers.test.ts tests/ai-agent.test.ts tests/ai-fencing.test.ts tests/ai-budget.test.ts tests/ai-concurrency.test.ts
```

`tests/ai-mock.ts` là mock provider (scripted replies, như `testing.py` của
Commerce Agents) để test agent logic mà không cần mạng/key. Toàn bộ 40 test
AI chạy offline. Test provider thật (Anthropic/OpenRouter/DeepSeek/…) = đổi env và
hỏi trợ lý trên UI; core agent không đổi (xem mục 3).

## 7. Checklist vận hành thực tế (production)

1. **Proxy**: đặt `TRUST_PROXY_COUNT=1` khi chạy sau 1 lớp proxy/LB —
   nếu không, rate-limit dùng IP spoof được qua `X-Forwarded-For`.
2. **Redis (Upstash)**: bắt buộc nếu chạy nhiều instance — không có thì
   rate-limit, đếm token và cap stream chỉ đúng trong 1 process.
3. **Ngân sách**: đặt `AI_MONTHLY_TOKEN_CAP` theo túi tiền (mỗi request
   worst-case ≈ 6 turns × (prompt + 1024 output)). Giám sát
   `agent.budget_near_limit`, `agent.budget_exceeded` trên Sentry/Datadog.
4. **Fallback**: cấu hình `AI_FALLBACKS` với provider khác hãng chính —
   đổi env, không sửa code. Kiểm tra `GET /api/agent/health` sau deploy.
5. **Uptime-monitor**: poll `/api/agent/health` mỗi 1-5 phút; cảnh báo khi
   `status != "ok"` (riêng `unconfigured` là chủ động tắt, không phải sự cố).
6. **Chất lượng trả lời**: theo dõi log `agent.feedback` (tỉ lệ 👍/👎 theo
   tuần); trace câu trả lời xấu qua `requestId` ↔ `agent.completed` +
   `tool.dispatch`.
7. **Audit/PII**: app cố tình không lưu nội dung hội thoại — khi cần điều
   tra abuse, dùng log requestId/provider/tool/latency (không có text).

## 8. Giới hạn do provider

- Tool calling là bắt buộc cho agent loop đầy đủ; provider nào tắt
  `toolCalls` sẽ chỉ còn trả lời chat đơn (runtime tự bỏ tool khỏi request).
- Structured output ưu tiên tool-forcing, fallback JSON-parse + zod validate.
- Token usage chỉ có khi provider trả `usage` (Anthropic + hầu hết OpenAI-compat có).