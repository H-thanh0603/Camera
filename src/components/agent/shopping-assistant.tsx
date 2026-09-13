"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/format";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
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
export function ShoppingAssistant() {
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

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateAssistant = (fn: (prev: string) => string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      if (last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, content: fn(last.content) }];
    });
  };

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setFailed(false);
    setBusy(true);
    setStatus("Đang kết nối trợ lý…");

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        updateAssistant(() => (data as { error?: string }).error ?? "Có lỗi xảy ra. Vui lòng thử lại.");
        setFailed(res.status === 503);
        return;
      }
      if (!res.body) {
        updateAssistant(() => "Không nhận được phản hồi. Vui lòng thử lại.");
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
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="ml-auto rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
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
                  "max-w-[90%] whitespace-pre-wrap rounded-xl px-space-sm py-space-xs font-body-sm text-body-sm",
                  m.role === "user" ? "self-end bg-primary text-on-primary" : "self-start bg-surface-container-high text-on-surface",
                )}
              >
                {m.content || (busy && i === messages.length - 1 ? "…" : "")}
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