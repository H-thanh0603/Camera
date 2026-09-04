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

export async function apiPlaceOrder(draft: {
  contact: unknown;
  shipping: unknown;
  delivery: string;
  payment: string;
  lines: { productId: string; variantId?: string; quantity: number }[];
}): Promise<Order> {
  return request<{ order: Order }>("/api/orders", { method: "POST", body: JSON.stringify(draft) }).then((r) => r.order);
}

export async function apiListOrders(): Promise<Order[]> {
  return request<{ orders: Order[] }>("/api/orders").then((r) => r.orders);
}

export async function apiCancelOrder(id: string): Promise<Order> {
  return request<{ order: Order }>(`/api/orders/${id}/cancel`, { method: "POST" }).then((r) => r.order);
}

export async function apiPayDemo(id: string): Promise<Order> {
  return request<{ order: Order }>(`/api/orders/${id}/pay-demo`, { method: "POST" }).then((r) => r.order);
}

/* ---------- Reviews ---------- */

export async function apiSubmitReview(input: {
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
}): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/reviews", { method: "POST", body: JSON.stringify(input) });
}

export async function apiGetProductReviews(productId: string): Promise<{ approved: Review[]; pending: Review[] }> {
  return request(`/api/products/${productId}/reviews`);
}
