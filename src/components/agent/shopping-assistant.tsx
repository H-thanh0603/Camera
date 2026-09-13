"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatVND } from "@/lib/utils/format";
import { useStore } from "@/state/store";

interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brand: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  priceVND: number;
  compareAtPriceVND?: number;
  availability: string;
  stock: number;
  rating: number;
  reviewCount: number;
}

interface PendingAgentAction {
  actionKey: string;
  summary: string;
  decision?: "approve" | "reject";
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** Card sản phẩm agent đã hiển thị kèm câu trả lời này. */
  cards?: ProductCard[];
  /** Hành động nhạy cảm agent đề xuất — chờ user duyệt. */
  action?: PendingAgentAction;
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
  type: "text" | "tool_call" | "tool_error" | "error" | "done" | "cards" | "action";
  text?: string;
  name?: string;
  message?: string;
  cards?: ProductCard[];
  actionKey?: string;
  summary?: string;
}

const STORAGE_KEY = "lumina.assistant.chat.v1";
/** Đủ 20 lượt hội thoại — trùng giới hạn history mà server chấp nhận. */
const MAX_STORED_MESSAGES = 40;

function isProductCard(c: unknown): c is ProductCard {
  if (!c || typeof c !== "object") return false;
  const v = c as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.slug === "string" && typeof v.name === "string" && typeof v.thumbnailUrl === "string" && typeof v.priceVND === "number";
}

function loadStoredMessages(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMsg[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ ...m, cards: Array.isArray(m.cards) ? m.cards.filter(isProductCard).slice(0, 6) : undefined }))
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

const AVAILABILITY_LABEL: Record<string, string> = {
  in_stock: "Còn hàng",
  low_stock: "Sắp hết",
  pre_order: "Đặt trước",
  out_of_stock: "Hết hàng",
  contact: "Liên hệ",
};

function AgentProductCard({ card, onAdd }: { card: ProductCard; onAdd: (card: ProductCard) => void }) {
  return (
    <div className="flex items-center gap-space-sm rounded-xl bg-surface-container p-space-2xs ring-1 ring-outline/10">
      {/* Ảnh thumbnail từ DB catalogue — widget ngoài layout, không cần image optimizer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.thumbnailUrl} alt={card.thumbnailAlt} width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <a href={`/products/${card.slug}`} className="block truncate font-label-md text-label-md text-on-surface hover:text-primary">
          {card.name}
        </a>
        <p className="font-telemetry-xs text-telemetry-xs text-on-surface-variant">
          {card.brand} · {AVAILABILITY_LABEL[card.availability] ?? card.availability} · ★ {card.rating.toFixed(1)} ({card.reviewCount})
        </p>
        <p className="font-label-md text-label-md text-on-surface">
          {formatVND(card.priceVND)}
          {card.compareAtPriceVND != null && card.compareAtPriceVND > card.priceVND && (
            <span className="ml-space-2xs font-body-xs text-body-xs text-outline line-through">{formatVND(card.compareAtPriceVND)}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-space-2xs">
        <a
          href={`/products/${card.slug}`}
          className="rounded-lg bg-surface-container-highest px-space-2xs py-space-2xs font-label-sm text-label-sm text-on-surface transition-colors hover:bg-outline/20"
        >
          Xem
        </a>
        {(card.availability === "in_stock" || card.availability === "low_stock") && card.stock > 0 && (
          <button
            type="button"
            onClick={() => onAdd(card)}
            className="rounded-lg bg-primary px-space-2xs py-space-2xs font-label-sm text-label-sm text-on-primary transition-opacity hover:opacity-90"
          >
            Thêm giỏ
          </button>
        )}
      </div>
    </div>
  );
}

export function ShoppingAssistant() {
  const { cart, addToCart } = useStore();

  /** Bấm "Thêm giỏ" trên card: resolve product tươi từ DB rồi thêm qua store. */
  async function addCardToCart(card: ProductCard) {
    try {
      const { apiResolveProducts } = await import("@/lib/api-client");
      await apiResolveProducts([card.id]);
      const { getProductById } = await import("@/lib/repositories/product-repository");
      const product = getProductById(card.id);
      if (!product) return;
      addToCart(product);
    } catch {
      // Resolve fail thì đưa khách sang trang sản phẩm — fallback an toàn.
      window.location.href = `/products/${card.slug}`;
    }
  }

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

  /** User duyệt/từ chối hành động agent đề xuất (thêm giỏ, theo dõi giá). */
  async function resolveAction(index: number, decision: "approve" | "reject") {
    const msg = messages[index];
    if (!msg?.action || msg.action.decision) return;
    const actionKey = msg.action.actionKey;
    setMessages((prev) => prev.map((m, i) => (i === index && m.action ? { ...m, action: { ...m.action, decision } } : m)));
    try {
      const res = await fetch("/api/agent/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionKey, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: { clientApply?: string; productId?: string; variantName?: string; quantity?: number; watching?: boolean }; error?: string };
      if (res.ok && decision === "approve") {
        const result = data.result;
        if (result?.clientApply === "add_to_cart" && result.productId) {
          // Giỏ là client state — widget tự thêm qua store (toast + drawer).
          const { apiResolveProducts } = await import("@/lib/api-client");
          await apiResolveProducts([result.productId]);
          const { getProductById } = await import("@/lib/repositories/product-repository");
          const product = getProductById(result.productId);
          if (product) addToCart(product, undefined, result.quantity ?? 1);
        }
        if (result?.watching) {
          updateAssistant((prev) => `${prev}\n✅ Đã đăng ký theo dõi giá. Bạn sẽ nhận email khi sản phẩm về ngưỡng đã chọn.`);
        }
      } else if (!res.ok) {
        const reason = data.error ?? "Không thực hiện được.";
        updateAssistant((prev) => `${prev}\n⚠️ ${reason}`);
      }
    } catch {
      updateAssistant((prev) => `${prev}\n⚠️ Không kết nối được. Thử lại sau.`);
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
        updateAssistant(() => (data as { error?: string }).error ?? "Có lỗi xảy ra. Vui lòng thử lại.", responseId);
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
          } else if (ev.type === "cards" && Array.isArray(ev.cards) && ev.cards.length > 0) {
            // Gắn card vào tin assistant đang stream — render sau khi text xong.
            const cards = ev.cards.filter(
              (c): c is ProductCard =>
                Boolean(c) && typeof c.id === "string" && typeof c.slug === "string" && typeof c.thumbnailUrl === "string",
            );
            if (cards.length > 0) setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.role === "assistant" ? { ...m, cards: [...(m.cards ?? []), ...cards] } : m)));
          } else if (ev.type === "action" && ev.actionKey && ev.summary) {
            // Tool ghi chờ duyệt — gắn vào tin assistant để render nút duyệt.
            const action: PendingAgentAction = { actionKey: ev.actionKey, summary: ev.summary };
            setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 && m.role === "assistant" ? { ...m, action } : m)));
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
                // Xoá cả phiên server-side để history không quay lại ở tin sau.
                void fetch("/api/agent/reset", { method: "POST" }).catch(() => undefined);
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
                {m.role === "assistant" && m.cards && m.cards.length > 0 && (
                  <div className="flex flex-col gap-space-2xs">
                    {m.cards.map((card) => (
                      <AgentProductCard key={card.id} card={card} onAdd={(c) => void addCardToCart(c)} />
                    ))}
                  </div>
                )}
                {m.role === "assistant" && m.action && (
                  <div className={cn("rounded-xl p-space-2xs ring-1", m.action.decision ? "ring-outline/20" : "ring-primary/40")}>
                    <p className="font-body-sm text-body-sm text-on-surface">{m.action.summary}</p>
                    {m.action.decision ? (
                      <p className="font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant">
                        {m.action.decision === "approve" ? "✓ Đã duyệt" : "✕ Đã từ chối"}
                      </p>
                    ) : (
                      <div className="mt-space-2xs flex gap-space-2xs">
                        <button
                          type="button"
                          onClick={() => void resolveAction(i, "approve")}
                          className="rounded-lg bg-primary px-space-sm py-space-2xs font-label-sm text-label-sm text-on-primary transition-opacity hover:opacity-90"
                        >
                          Duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => void resolveAction(i, "reject")}
                          className="rounded-lg bg-surface-container-highest px-space-sm py-space-2xs font-label-sm text-label-sm text-on-surface transition-colors hover:bg-outline/20"
                        >
                          Để sau
                        </button>
                      </div>
                    )}
                  </div>
                )}
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