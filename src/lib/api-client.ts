import type { Order, Review, SessionUser } from "@/lib/types";

/**
 * API client — cầu nối UI ↔ API routes.
 * Mọi fetch đi qua đây với xử lý lỗi thống nhất (không gọi fetch rải rác trong component).
 */

export interface AuthError {
  field?: "email" | "password" | "name";
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? "Có lỗi xảy ra. Vui lòng thử lại.", (data as { fieldErrors?: Record<string, string> }).fieldErrors);
  }
  return data as T;
}

/* ---------- Auth ---------- */

export async function apiLogin(email: string, password: string): Promise<SessionUser> {
  const { user } = await request<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return user;
}

export async function apiRegister(name: string, email: string, password: string): Promise<SessionUser> {
  const { user } = await request<{ user: SessionUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  return user;
}

export async function apiLogout(): Promise<void> {
  await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function apiMe(): Promise<SessionUser | null> {
  const { user } = await request<{ user: SessionUser | null }>("/api/auth/me");
  return user;
}

export function toAuthError(err: unknown): AuthError {
  if (err instanceof ApiError) {
    const firstField = err.fieldErrors ? (Object.keys(err.fieldErrors)[0] as AuthError["field"]) : undefined;
    return { field: firstField, message: err.fieldErrors?.[firstField ?? ""] ?? err.message };
  }
  return { message: "Không thể kết nối server. Vui lòng thử lại." };
}

/* ---------- Orders ---------- */

const GUEST_TOKENS_KEY = "lumina.guestTokens";

function readGuestTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GUEST_TOKENS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Lưu token sở hữu đơn guest (trả 1 lần lúc đặt hàng) vào localStorage. */
export function saveGuestToken(orderId: string, token: string): void {
  try {
    localStorage.setItem(GUEST_TOKENS_KEY, JSON.stringify({ ...readGuestTokens(), [orderId]: token }));
  } catch {
    // storage đầy/blocked → bỏ qua, user vẫn thấy đơn trong phiên này
  }
}

function guestTokenOf(orderId: string): string | undefined {
  try {
    return readGuestTokens()[orderId];
  } catch {
    return undefined;
  }
}

export function newGuestToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function apiPlaceOrder(
  draft: {
    contact: unknown;
    shipping: unknown;
    delivery: string;
    payment: string;
    lines: { productId: string; variantId?: string; quantity: number }[];
    couponCode?: string;
    guestToken?: string;
  },
  idempotencyKey?: string,
): Promise<Order> {
  const order = await request<{ order: Order }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(draft),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  }).then((r) => r.order);
  if (order.guestToken) saveGuestToken(order.id, order.guestToken);
  return order;
}

export async function apiListOrders(): Promise<Order[]> {
  return request<{ orders: Order[] }>("/api/orders").then((r) => r.orders);
}

function guestHeaders(id: string): Record<string, string> {
  const token = guestTokenOf(id);
  return token ? { "x-guest-token": token } : {};
}

export async function apiCancelOrder(id: string): Promise<Order> {
  return request<{ order: Order }>(`/api/orders/${id}/cancel`, {
    method: "POST",
    headers: guestHeaders(id),
  }).then((r) => r.order);
}

export async function apiPayDemo(id: string): Promise<Order> {
  return request<{ order: Order }>(`/api/orders/${id}/pay-demo`, {
    method: "POST",
    headers: guestHeaders(id),
  }).then((r) => r.order);
}

export async function apiLookupGuestOrder(number: string, token: string): Promise<Order> {
  const params = new URLSearchParams({ number, token });
  return request<{ order: Order }>(`/api/orders/lookup?${params.toString()}`).then((r) => r.order);
}

/* ---------- Catalog resolve (bounded, thay snapshot full) ---------- */

export async function apiResolveProducts(ids: string[]): Promise<import("@/lib/types").Product[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (unique.length === 0) return [];
  const { products } = await request<{ products: import("@/lib/types").Product[] }>("/api/products/resolve", {
    method: "POST",
    body: JSON.stringify({ ids: unique }),
  });
  const { mergeCatalogProducts } = await import("@/lib/repositories/product-repository");
  mergeCatalogProducts(products);
  return products;
}

/* ---------- Reviews ---------- */

export async function apiSubmitReview(input: {
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  photos?: string[];
}): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/reviews", { method: "POST", body: JSON.stringify(input) });
}

export async function apiGetProductReviews(productId: string): Promise<{ approved: Review[]; pending: Review[] }> {
  return request(`/api/products/${productId}/reviews`);
}
