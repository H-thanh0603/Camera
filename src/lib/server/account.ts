import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { destroySession } from "./session";
import { logAudit } from "./audit";
import { dbOrderToDomain } from "./order-mapper";

/**
 * GDPR tự phục vụ — xuất và xóa dữ liệu tài khoản.
 * Xóa tài khoản: giữ lại đơn hàng/review (userId → null) cho kế toán và
 * tính rating; xóa sessions, reset tokens, saved battles, hồ sơ user.
 * Không phải admin cuối cùng (mirror guard route admin).
 */

export class AccountError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

/** Gom toàn bộ dữ liệu cá nhân của user thành JSON tải về. */
export async function exportAccountData(userId: string): Promise<Record<string, unknown>> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AccountError("Không tìm thấy tài khoản.", 404);
  const [orders, reviews, battles, sessions] = await Promise.all([
    prisma.order.findMany({ where: { userId }, include: { lines: true }, orderBy: { createdAt: "desc" } }),
    prisma.review.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.savedBattle.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.session.findMany({ where: { userId }, select: { id: true, createdAt: true, expiresAt: true } }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    orders: orders.map(dbOrderToDomain),
    reviews: reviews.map((r) => ({
      id: r.id, productId: r.productId, author: r.author, rating: r.rating,
      title: r.title, body: r.body, approved: r.approved, createdAt: r.createdAt,
    })),
    savedBattles: battles,
    sessions: sessions.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt })),
  };
}

export interface DeleteAccountInput {
  /** Tài khoản mật khẩu: bắt buộc, verify. Tài khoản OAuth: bỏ trống. */
  password?: string;
  /** Tài khoản OAuth: mã OTP 6 số gửi tới email (F7 — email public không đủ làm yếu tố 2). */
  otp?: string;
}

/** Xóa tài khoản của chính mình (đã xác thực sở hữu) + đăng xuất mọi phiên. */
export async function deleteOwnAccount(userId: string, input: DeleteAccountInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AccountError("Không tìm thấy tài khoản.", 404);
  if (user.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      throw new AccountError("Bạn là admin cuối cùng — chuyển quyền trước khi xóa.", 409);
    }
  }
  const isOAuth = user.passwordHash.startsWith("oauth:");
  if (isOAuth) {
    // F7: OTP email làm yếu tố thứ hai — phiên bị đánh cắp (XSS) không xóa
    // được tài khoản vì attacker không đọc được inbox của chủ tài khoản.
    if (!input.otp) {
      throw new AccountError("Cần mã xác nhận đã gửi tới email của bạn.", 422);
    }
    const { verifyEmailOtp } = await import("./email-otp");
    try {
      await verifyEmailOtp(user.id, input.otp, "account-delete");
    } catch (error) {
      if (error instanceof Error && error.name === "TwoFactorError") {
        throw new AccountError(error.message, (error as unknown as { status: number }).status ?? 422);
      }
      throw error;
    }
  } else {
    if (!input.password || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AccountError("Mật khẩu không đúng.", 401);
    }
  }
  // Đá mọi phiên trước (kể cả phiên hiện tại), rồi xóa hồ sơ.
  // Cascade: sessions/resetTokens/battles mất; orders/reviews/audit giữ lại
  // với userId null (kế toán + rating không vỡ).
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await logAudit(null, "user.self_deleted", "User", userId, { role: user.role });
  await destroySession().catch(() => undefined);
}
