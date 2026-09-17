import type { OrderStatus } from "@/lib/types";

/**
 * Trạng thái khách được tự hủy. `paid` KHÔNG nằm trong danh sách (M1):
 * đơn đã thu tiền phải qua luồng refund (hoàn tiền cổng thanh toán) chứ
 * không phải cancel-restocks-không-hoàn-tiền. `processing` giữ lại (chưa
 * thu tiền online: cod/bank-transfer có thể hủy trước khi giao).
 */
export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "processing"];
