/**
 * Agent chat session — history hội thoại lưu server-side.
 *
 * Cookie `agent_sid` giữ raw id (64 hex); DB chỉ lưu SHA-256 (mẫu guest-token).
 * History được fence TRƯỚC KHI ghi, giới hạn 40 tin (20 lượt). Widget vẫn
 * render từ localStorage cho instant-load, nhưng server là nguồn chân lý:
 * đổi thiết bị/máy vẫn còn ngữ cảnh nếu cùng cookie.
 *
 * Session là dữ liệu vãng lai (không gắn user) — TTL 30 ngày, dọn bởi
 * cron dọn session, và không chứa PII ngoài nội dung chat khách đã gửi.
 */

import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { fenceText } from "@/lib/ai/agent/fencing";

export const AGENT_SID_COOKIE = "agent_sid";
const SESSION_TTL_MS = 30 * 86_400_000;
const MAX_MESSAGES = 40;

export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  cards?: unknown[];
}

export function newAgentSid(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashAgentSid(sid: string): string {
  return createHash("sha256").update(sid.trim(), "utf8").digest("hex");
}

/** Fence trước khi ghi — mọi nội dung vào DB đều đã được làm sạch. */
function sanitizeMessages(messages: StoredChatMessage[]): StoredChatMessage[] {
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: fenceText(m.content, 4000),
      ...(Array.isArray(m.cards) ? { cards: m.cards.slice(0, 6) } : {}),
    }));
}

/** Đọc history của session; trả [] nếu chưa có / hết hạn. */
export async function getAgentHistory(rawSid: string | undefined): Promise<StoredChatMessage[]> {
  if (!rawSid) return [];
  try {
    const row = await prisma.agentSession.findUnique({ where: { idHash: hashAgentSid(rawSid) } });
    if (!row || row.expiresAt.getTime() < Date.now()) return [];
    const messages = row.messages as unknown;
    if (!Array.isArray(messages)) return [];
    return messages.filter((m): m is StoredChatMessage => Boolean(m) && typeof m === "object");
  } catch {
    return []; // session là tính năng phụ — lỗi DB không phá chat
  }
}

/** Upsert history đã fence; tạo mới khi sid chưa có row. */
export async function saveAgentHistory(rawSid: string, messages: StoredChatMessage[]): Promise<void> {
  const clean = sanitizeMessages(messages);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  try {
    await prisma.agentSession.upsert({
      where: { idHash: hashAgentSid(rawSid) },
      create: { idHash: hashAgentSid(rawSid), messages: clean as object[], expiresAt },
      update: { messages: clean as object[], expiresAt },
    });
  } catch {
    // Fail-write không phá chat — client vẫn còn localStorage copy
  }
}

/** Xoá session (nút hội thoại mới) — fail-safe. */
export async function deleteAgentSession(rawSid: string | undefined): Promise<void> {
  if (!rawSid) return;
  try {
    await prisma.agentSession.delete({ where: { idHash: hashAgentSid(rawSid) } });
  } catch {
    // Row không tồn tại hoặc DB lỗi — cookie bị client xoá là đủ
  }
}
