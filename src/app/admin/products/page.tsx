import { dbAllProducts } from "@/lib/server/product-db";
import { ProductsAdmin } from "@/components/admin/products-admin";

export const metadata = { title: "Quản trị sản phẩm" };

export default async function AdminProductsPage() {
  const products = await dbAllProducts();
  return <ProductsAdmin initialProducts={products} />;
}
