/**
 * AgentAction store — hành động nhạy cảm chờ user duyệt.
 *
 * Flow: tool ghi gọi prepareAction → tạo row pending (TTL 10 phút) →
 * model nói với user "sắp làm X, duyệt nhé" → user bấm duyệt ở widget →
 * POST /api/agent/action (approve) → chạy ngay bằng data đã lưu →
 * mark executed. KHÔNG bao giờ client gửi payload hành động — chỉ actionKey.
 */

import { prisma } from "./prisma";
import { logger } from "./logger";
import { hashAgentSid } from "./agent-session";

const ACTION_TTL_MS = 10 * 60_000;

export interface PendingAction {
  actionKey: string;
  tool: string;
  summary: string;
  data: Record<string, unknown>;
}

/** Tạo (hoặc refresh) hành động chờ duyệt. */
export async function createAgentAction(rawSid: string, action: PendingAction): Promise<void> {
  const sessionHash = hashAgentSid(rawSid);
  const expiresAt = new Date(Date.now() + ACTION_TTL_MS);
  try {
    await prisma.agentAction.upsert({
      where: { sessionHash_actionKey: { sessionHash, actionKey: action.actionKey } },
      create: { sessionHash, actionKey: action.actionKey, tool: action.tool, summary: action.summary, data: action.data as object, expiresAt },
      update: { tool: action.tool, summary: action.summary, data: action.data as object, status: "pending", expiresAt, executedAt: null },
    });
  } catch (err) {
    logger.error("agent_action.create_failed", { error: String(err) });
  }
}

export interface ApprovedRow {
  id: string;
  tool: string;
  summary: string;
  data: Record<string, unknown>;
}

/** Lấy row pending hợp lệ (chưa duyệt + chưa hết hạn) — null nếu không. */
export async function getPendingAction(rawSid: string, actionKey: string): Promise<ApprovedRow | null> {
  const sessionHash = hashAgentSid(rawSid);
  try {
    const row = await prisma.agentAction.findUnique({
      where: { sessionHash_actionKey: { sessionHash, actionKey } },
    });
    if (!row || row.status !== "pending" || row.expiresAt.getTime() < Date.now()) return null;
    return { id: row.id, tool: row.tool, summary: row.summary, data: row.data as Record<string, unknown> };
  } catch (err) {
    logger.error("agent_action.get_failed", { actionKey, error: String(err) });
    return null;
  }
}

/** Đánh dấu đã thực thi (sau khi tool chạy thành công). */
export async function markActionExecuted(id: string): Promise<void> {
  try {
    await prisma.agentAction.update({ where: { id }, data: { status: "executed", executedAt: new Date() } });
  } catch (err) {
    logger.error("agent_action.mark_failed", { id, error: String(err) });
  }
}
