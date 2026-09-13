/**
 * Tool permission — mỗi tool khai báo quyền cần; executor/agent check trước
 * khi expose và trước khi chạy. Tách policy khỏi định nghĩa tool để route
 * (session admin vs guest) quyết định scope mà không sửa tool.
 *
 * Mức quyền (tăng dần):
 *   read     — chỉ đọc catalogue (search/details/compare/show…)
 *   cart     — ghi giỏ hàng của chính session (cần user approval từng lần)
 *   delegate — tạo nhiệm vụ nền cho session (theo dõi giá, cần approval)
 *
 * Guest được read + cart(approval) + delegate(approval). Admin có tất cả
 * (hiện chưa có tool nào cần hơn — cứ để policy mở rộng).
 */

export type ToolPermission = "read" | "cart" | "delegate" | "admin";

/** Policy do caller (route) dựng theo session; tool tự khai nhu cầu. */
export interface ToolPolicy {
  allowed: (perm: ToolPermission | undefined) => boolean;
}

export const GUEST_POLICY: ToolPolicy = {
  allowed: (perm) => perm === undefined || perm === "read" || perm === "cart" || perm === "delegate",
};

export const ADMIN_POLICY: ToolPolicy = {
  allowed: () => true,
};

/** Tool có hành động nhạy cảm — cần user duyệt qua approval event trước khi chạy. */
export function requiresApproval(perm: ToolPermission | undefined): boolean {
  return perm === "cart" || perm === "delegate";
}
