import { requireAdminPage } from "@/lib/server/admin";
import { CouponsAdmin } from "@/components/admin/coupons-admin";

export const metadata = { title: "Mã giảm giá" };

export default async function AdminCouponsPage() {
  await requireAdminPage();
  return <CouponsAdmin />;
}
