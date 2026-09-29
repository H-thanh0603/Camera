import { requireAdminPage } from "@/lib/server/admin";
import { MerchantDraftsAdmin } from "@/components/admin/merchant-drafts-admin";

export const metadata = { title: "Bản nháp mô tả AI — Admin" };

export default async function AdminDraftsPage() {
  await requireAdminPage();
  return <MerchantDraftsAdmin />;
}
