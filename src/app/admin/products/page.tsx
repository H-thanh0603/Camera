import { requireAdminPage } from "@/lib/server/admin";
import { dbQueryProducts } from "@/lib/server/product-db";
import { ProductsAdminWithImport } from "@/components/admin/products-admin-with-import";

export const metadata = { title: "Quản trị sản phẩm" };

export default async function AdminProductsPage() {
  await requireAdminPage();
  // Admin cần full list nhưng bounded (pageSize 60, không join reviews)
  const { items: products } = await dbQueryProducts({ pageSize: 60 });
  return <ProductsAdminWithImport initialProducts={products} />;
}
