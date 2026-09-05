/**
 * Analytics/Tracking abstraction (client).
 * Toàn bộ event đo lường đi qua track() — hiện gửi tới /api/metrics
 * (server ghi log có cấu trúc). Sau này đổ vào GA4 / Plausible / Umami
 * chỉ cần đổi thân hàm này, không sửa instrumentation ở UI.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsEvent =
  | "web_vital"
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "search"
  | "client_error";

export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ event, props, ts: Date.now(), path: window.location.pathname });
  try {
    // sendBeacon không block unload — chuẩn cho analytics
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/metrics", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    // Tracking không được phá vỡ UX — im lặng
  }
}
