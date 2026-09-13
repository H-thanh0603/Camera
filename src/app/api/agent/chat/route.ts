/**
 * POST /api/agent/chat — Lumina shopping assistant (server-sent events).
 *
 * A client posts { message, history? }. The server runs the provider-agnostic
 * commerce agent (system prompt + tools) and streams neutral events back:
 *   text            assistant text delta
 *   tool_call/error UI-friendly tool lifecycle
 *   done            end of turn (or agent error event)
 *
 * API keys never leave the server: the frontend only sees this route.
 * When AI_PROVIDER/API key are not configured, the route 503s with a
 * user-safe message instead of crashing the rest of the app.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/server/client-ip";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { logger } from "@/lib/server/logger";
import {
  getAIConfig,
  buildExecutor,
  buildProviderChain,
  buildChatMessages,
  streamWithFallback,
  SHOPPING_ASSISTANT_SYSTEM_PROMPT,
} from "@/lib/ai";
import { getDbCommerceSource } from "@/lib/ai/tools/db-source";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 120_000;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

/** 10 requests / minute / IP — this route burns LLM tokens. */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!(await limiter.check(`agent:${ip}`)).allowed) {
    return NextResponse.json({ error: "Bạn hỏi quá nhanh. Nghỉ một chút rồi thử lại." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Tin nhắn chưa hợp lệ (tối đa 2000 ký tự)." }, { status: 422 });
  }

  const config = getAIConfig();
  if (!config.enabled) {
    logger.warn("agent.unconfigured", { route: "agent/chat", ip });
    return NextResponse.json(
      { error: "Trợ lý AI chưa được cấu hình. Liên hệ quản trị viên để bật AI_PROVIDER." },
      { status: 503 },
    );
  }

  const providers = buildProviderChain(config);
  if (providers.length === 0) {
    return NextResponse.json({ error: "Không có provider AI khả dụng." }, { status: 503 });
  }
  const requestId = newRequestId();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  request.signal.addEventListener("abort", () => controller.abort());

  const messages = buildChatMessages({
    message: parsed.data.message,
    history: parsed.data.history,
    system: SHOPPING_ASSISTANT_SYSTEM_PROMPT,
  });
  const executor = buildExecutor(getDbCommerceSource());
  const startedAt = Date.now();
  logger.info("agent.request", {
    route: "agent/chat",
    requestId,
    provider: config.provider,
    model: config.model,
    engine: "db",
    historyTurns: parsed.data.history?.length ?? 0,
    fallbackCount: Math.max(0, providers.length - 1),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const enc = new TextEncoder();
      const push = (text: string) => ctrl.enqueue(enc.encode(text));
      try {
        for await (const ev of streamWithFallback(
          {
            providers,
            executor,
            requestId,
            logger,
            maxIterations: config.maxIterations,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            signal: controller.signal,
          },
          messages,
        )) {
          switch (ev.type) {
            case "text":
              push(sseLine({ type: "text", text: ev.text }));
              break;
            case "tool_call":
              push(sseLine({ type: "tool_call", name: ev.call.name }));
              break;
            case "tool_error":
              push(sseLine({ type: "tool_error", name: ev.call.name, message: ev.message }));
              break;
            case "max_iterations":
              push(sseLine({ type: "tool_error", name: "assistant", message: "Tôi cần thêm thông tin. Hãy hỏi cụ thể hơn." }));
              break;
            case "error":
              push(sseLine({ type: "error", message: ev.message }));
              break;
            case "done":
            case "tool_result":
              break;
          }
        }
        push(sseLine({ type: "done" }));
        logger.info("agent.completed", { route: "agent/chat", requestId, ms: Date.now() - startedAt });
      } catch (err) {
        const aborted = controller.signal.aborted;
        push(sseLine({ type: "error", message: aborted ? "Yêu cầu đã bị hủy." : "Có lỗi xảy ra với trợ lý. Vui lòng thử lại." }));
        logger.error("agent.failed", { route: "agent/chat", requestId, aborted, error: err instanceof Error ? err.message : String(err) });
      } finally {
        clearTimeout(timeout);
        ctrl.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}