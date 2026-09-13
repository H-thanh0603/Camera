"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/format";
import { useStore } from "@/state/store";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** requestId của /api/agent/chat đã sinh câu trả lời này (nút 👍👎 dùng). */
  requestId?: string;
  /** Trạng thái feedback người dùng đã bấm cho câu trả lời này. */
  feedback?: "up" | "down";
}

const QUICK_PROMPTS = [
  "Gợi ý máy ảnh tầm 100–250 triệu",
  "Tìm ống kính chân dung giá tốt",
  "So sánh full-frame và medium format",
  "Máy nào tốt để quay video?",
] as const;

interface StreamEvent {
  type: "text" | "tool_call" | "tool_error" | "error" | "done";
  text?: string;
  name?: string;
  message?: string;
}

const STORAGE_KEY = "lumina.assistant.chat.v1";
/** Đủ 20 lượt hội thoại — trùng giới hạn history mà server chấp nhận. */
const MAX_STORED_MESSAGES = 40;

function loadStoredMessages(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMsg[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function parseSse(buffer: string): { events: StreamEvent[]; rest: string } {
  const events: StreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    for (const line of part.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      try {
        events.push(JSON.parse(trimmed.slice(5).trim()) as StreamEvent);
      } catch {
        // Bỏ frame lỗi — stream tiếp tục
      }
    }
  }
  return { events, rest };
}
/** Context trang hiện tại để agent "thấy" những gì khách đang xem. */
function buildPageContext(cartCount: number, cartTotal: number): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const path = window.location.pathname;
  const ctx: Record<string, unknown> = { page: path.slice(0, 200) };
  // Trang sản phẩm: /products/[slug] — agent biết "máy này" là máy nào.
  const m = path.match(/^\/(?:products?|san-pham)\/([^/?#]+)/);
  if (m) ctx.productSlug = decodeURIComponent(m[1]!).slice(0, 200);
  const q = new URLSearchParams(window.location.search);
  const category = q.get("category");
  if (category) ctx.category = category.slice(0, 40);
  ctx.cartCount = cartCount;
  if (cartTotal > 0) ctx.cartTotalVND = cartTotal;
  return ctx;
}

export function ShoppingAssistant() {
  const { cart, addToCart } = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, open]);

  // Khôi phục hội thoại sau khi mount để tránh lệch hydration.
  const hydrated = useRef(false);
  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) setMessages(stored);
    hydrated.current = true;
  }, []);

  // Lưu sau mỗi thay đổi (debounce để không ghi mỗi delta khi stream).
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      try {
        // Bỏ tin assistant rỗng cuối nếu đóng trang giữa lúc đang stream.
        const toStore = messages.filter((m, i) => !(m.role === "assistant" && !m.content && i === messages.length - 1));
        if (toStore.length === 0) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore.slice(-MAX_STORED_MESSAGES)));
      } catch {
        // localStorage đầy/tắt — tính năng lưu là best-effort
      }
    }, 300);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateAssistant = (fn: (prev: string) => string, requestId?: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      if (last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, content: fn(last.content), requestId: requestId ?? last.requestId }];
    });
  };

  async function sendFeedback(index: number, rating: "up" | "down") {
    const msg = messages[index];
    if (!msg || msg.role !== "assistant" || !msg.requestId || msg.feedback === rating) return;
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, feedback: rating } : m)));
    try {
      await fetch("/api/agent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, requestId: msg.requestId, snippet: msg.content.slice(0, 280) }),
      });
    } catch {
      // Feedback là best-effort — không báo lỗi cho người dùng
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const context = buildPageContext(cart.length, 0);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setFailed(false);
    setBusy(true);
    setStatus("Đang kết nối trợ lý…");

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, context }),
        signal: controller.signal,
      });
      const responseId = res.headers.get("X-Request-Id") ?? undefined;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        updateAssistant((prev) => (data as { error?: string }).error ?? "Có lỗi xảy ra. Vui lòng thử lại.", responseId);
        setFailed(res.status === 503);
        return;
      }
      if (!res.body) {
        updateAssistant(() => "Không nhận được phản hồi. Vui lòng thử lại.", responseId);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      setStatus("Trợ lý đang trả lời…");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const ev of parsed.events) {
          if (ev.type === "text" && typeof ev.text === "string") {
            const chunk = ev.text;
            setStatus(null);
            updateAssistant((prev) => prev + chunk);
          } else if (ev.type === "tool_call") {
            setStatus(ev.name === "compare_products" ? "Đang so sánh sản phẩm…" : ev.name === "recommend_products" ? "Đang gợi ý phù hợp…" : "Đang tra cứu sản phẩm…");
          } else if (ev.type === "tool_error" && ev.message) {
            updateAssistant((prev) => (prev ? `${prev}\n${ev.message}` : (ev.message as string)));
          } else if (ev.type === "error" && ev.message) {
            updateAssistant(() => ev.message as string);
          }
        }
      }
    } catch (streamErr) {
      if ((streamErr as Error).name !== "AbortError") {
        updateAssistant((prev) => prev || "Có lỗi xảy ra với trợ lý. Vui lòng thử lại.");
      }
    } finally {
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Đóng trợ lý mua sắm" : "Mở trợ lý mua sắm"}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-[26px]" aria-hidden="true">{open ? "close" : "smart_toy"}</span>
      </button>

      {open && (
        <section
          aria-label="Trợ lý mua sắm Lumina"
          className="fixed bottom-24 right-5 z-[60] flex h-[min(560px,70vh)] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-surface-container shadow-2xl ring-1 ring-outline/20"
        >
          <header className="flex items-center gap-space-sm bg-surface-container-high px-space-md py-space-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20" aria-hidden="true">
              <span className="material-symbols-outlined text-[20px] text-primary">smart_toy</span>
            </span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface">Lumina Assistant</span>
              <span className="font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant">Trợ lý mua sắm AI</span>
            </div>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setMessages([]);
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {
                  /* best-effort */
                }
              }}
              disabled={busy || messages.length === 0}
              aria-label="Bắt đầu hội thoại mới"
              title="Bắt đầu hội thoại mới"
              className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">restart_alt</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          </header>

          <div ref={listRef} className="flex flex-1 flex-col gap-space-sm overflow-y-auto px-space-md py-space-sm" role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="flex flex-col gap-space-sm">
                <p className="rounded-xl bg-surface-container-high p-space-sm font-body-sm text-body-sm text-on-surface-variant">
                  Xin chào! Tôi giúp bạn tìm máy ảnh, ống kính và phụ kiện phù hợp từ kho hàng thật của Lumina. Hãy hỏi tôi nhé.
                </p>
                <div className="flex flex-wrap gap-space-xs">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(q)}
                      className="rounded-full bg-surface-container-high px-space-sm py-space-2xs font-body-sm text-body-sm text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex max-w-[90%] flex-col gap-space-2xs rounded-xl px-space-sm py-space-xs font-body-sm text-body-sm",
                  m.role === "user" ? "self-end bg-primary text-on-primary" : "self-start bg-surface-container-high text-on-surface",
                )}
              >
                <div className="whitespace-pre-wrap">{m.content || (busy && i === messages.length - 1 ? "…" : "")}</div>
                {m.role === "assistant" && m.content && m.requestId && !busy && (
                  <div className="flex items-center justify-end gap-space-2xs">
                    <button
                      type="button"
                      onClick={() => void sendFeedback(i, "up")}
                      disabled={m.feedback === "down"}
                      aria-label="Câu trả lời hữu ích"
                      title="Câu trả lời hữu ích"
                      className={cn(
                        "rounded-md p-1 text-[16px] transition-colors",
                        m.feedback === "up" ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:bg-surface-container-highest",
                      )}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">thumb_up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendFeedback(i, "down")}
                      disabled={m.feedback === "up"}
                      aria-label="Câu trả lời chưa tốt"
                      title="Câu trả lời chưa tốt"
                      className={cn(
                        "rounded-md p-1 transition-colors",
                        m.feedback === "down" ? "bg-error/20 text-error" : "text-on-surface-variant hover:bg-surface-container-highest",
                      )}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">thumb_down</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {status && (
              <p className="flex items-center gap-space-xs self-start font-telemetry-xs text-telemetry-xs uppercase text-outline" role="status">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" aria-hidden="true" />
                {status}
              </p>
            )}
            {failed && (
              <p className="self-start rounded-xl bg-surface-container-high p-space-sm font-body-sm text-body-sm text-on-surface-variant">
                Trợ lý AI chưa được cấu hình trên máy chủ. Quản trị viên cần đặt AI_PROVIDER và API key trong biến môi trường.
              </p>
            )}
          </div>

          <form
            className="flex items-center gap-space-xs border-t border-outline/10 bg-surface-container-low px-space-sm py-space-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="lumina-assistant-input" className="sr-only">Hỏi trợ lý mua sắm</label>
            <input
              id="lumina-assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              maxLength={2000}
              placeholder="Hỏi về máy ảnh, ống kính, giá, so sánh…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg bg-surface-container-high px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-2 focus:outline-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Gửi"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary transition-opacity disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">send</span>
            </button>
          </form>
        </section>
      )}
    </>
  );
}