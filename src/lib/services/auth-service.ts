import type { SessionUser } from "@/lib/types";
import { loadJSON, removeKey, saveJSON } from "@/lib/repositories/storage-repository";

/**
 * AuthService — mock authentication layer.
 * Khi tích hợp backend: thay bằng JWT/session cookie (httpOnly) qua
 * POST /auth/login — KHÔNG lưu token/password vào localStorage.
 * Session mock dưới đây chỉ chứa { id, name, email } phi nhạy cảm.
 */

const SESSION_KEY = "auth.session";

export interface AuthError {
  field?: "email" | "password" | "name";
  message: string;
}

export function getSession(): SessionUser | null {
  return loadJSON<SessionUser | null>(SESSION_KEY, null);
}

export async function login(email: string, password: string): Promise<SessionUser> {
  await new Promise((r) => setTimeout(r, 600));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw <AuthError>{ field: "email", message: "Email không hợp lệ." };
  }
  if (password.length < 8) {
    throw <AuthError>{ field: "password", message: "Mật khẩu cần tối thiểu 8 ký tự." };
  }
  const existing = loadJSON<SessionUser | null>(SESSION_KEY, null);
  const user: SessionUser = existing && existing.email === email ? existing : { id: `u_${email.toLowerCase()}`, name: email.split("@")[0], email };
  saveJSON(SESSION_KEY, user);
  return user;
}

export async function register(name: string, email: string, password: string): Promise<SessionUser> {
  await new Promise((r) => setTimeout(r, 600));
  if (name.trim().length < 2) {
    throw <AuthError>{ field: "name", message: "Vui lòng nhập họ tên." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw <AuthError>{ field: "email", message: "Email không hợp lệ." };
  }
  if (password.length < 8) {
    throw <AuthError>{ field: "password", message: "Mật khẩu cần tối thiểu 8 ký tự." };
  }
  const user: SessionUser = { id: `u_${email.toLowerCase()}`, name: name.trim(), email: email.toLowerCase() };
  saveJSON(SESSION_KEY, user);
  return user;
}

export function logout(): void {
  removeKey(SESSION_KEY);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw <AuthError>{ field: "email", message: "Email không hợp lệ." };
  }
  // Backend thật sẽ gửi email reset — mock chỉ xác nhận đã nhận yêu cầu.
}
