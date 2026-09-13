# Lumina Commerce Agent — provider-agnostic AI shopping assistant

Tích hợp có chọn lọc **Commerce Agents** (shopping-agent: tool executor, fencing,
backend, streaming, checkout handoff) vào LUMINA Optics — **không hard-code
Anthropic**. Mọi model đều chạy qua `AIProvider`; đổi provider/model chỉ bằng env.

## 1. Kiến trúc

```text
Frontend chat widget (components/agent/shopping-assistant.tsx)
  │  POST /api/agent/chat (SSE, không API key)
  ▼
Commerce Agent (src/lib/ai/agent/runtime.ts — độc lập provider)
  │  tool calls (Agent → ToolExecutor: failure ladder, zod validate)
  ▼
Commerce tools (search/details/compare/recommend/price/availability/categories/top)
  │  qua CommerceDataSource (seed | db) — tái dùng product-db + services có sẵn
  ▼
AgentRuntime → AIProvider → Provider adapter → LLM
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
`AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, `AI_MAX_ITERATIONS`.
Thiếu key → `/api/agent/chat` trả 503 thân thiện, app còn lại vẫn chạy.

## 4. Thêm commerce tool mới

1. Định nghĩa zod schema + `CommerceTool` trong `src/lib/ai/tools/` (xem
   `commerce-tools.ts`), chỉ đọc từ `CommerceDataSource`.
2. Thêm vào `createCommerceTools()` / `compare-recommend.ts` (test sẽ bắt nếu thiếu).
3. Runtime tự expose qua `executor.specs()` cho mọi provider — **không cần
   viết lại schema theo vendor**.

Quy tắc: tool **read-only** (không đặt/huỷ đơn, không thanh toán — agent chỉ tư
vấn, web lo checkout — đúng triết lý Commerce Agents "checkout handoff").

## 5. Bảo mật

- Key server-only; frontend chỉ gọi `/api/agent/chat`.
- `fenceText`/`fenceProduct`: làm sạch mô tả/tag/review trước khi vào prompt;
  kết quả tool bọc `<tool-data>` và coi như dữ liệu.
- Validate args bằng zod; lỗi hệ thống trả generic (không lộ stack/internal).
- Rate-limit 10 req/phút/IP; message ≤2000 ký tự; history ≤20 turns.
- Engine ghi log requestId/provider/model/tool/latency/usage — **không log key**.

## 6. Chạy & kiểm thử

```bash
npx vitest run tests/ai-providers.test.ts tests/ai-agent.test.ts tests/ai-fencing.test.ts
```

`tests/ai-mock.ts` là mock provider (scripted replies, như `testing.py` của
Commerce Agents) để test agent logic mà không cần mạng/key. Toàn bộ 28 test AI
chạy offline. Test provider thật (Anthropic/OpenRouter/DeepSeek/…) = đổi env và
hỏi trợ lý trên UI; core agent không đổi (xem mục 3).

## 7. Giới hạn do provider

- Tool calling là bắt buộc cho agent loop đầy đủ; provider nào tắt
  `toolCalls` sẽ chỉ còn trả lời chat đơn (runtime tự bỏ tool khỏi request).
- Structured output ưu tiên tool-forcing, fallback JSON-parse + zod validate.
- Token usage chỉ có khi provider trả `usage` (Anthropic + hầu hết OpenAI-compat có).