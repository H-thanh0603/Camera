import { requireAdminPage } from "@/lib/server/admin";
import { UsersAdmin } from "@/components/admin/users-admin";

export const metadata = { title: "Tài khoản & phân quyền" };

export default async function AdminUsersPage() {
  await requireAdminPage();
  return <UsersAdmin />;
}
