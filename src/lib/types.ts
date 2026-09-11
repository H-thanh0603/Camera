/**
 * Domain model cho Lumina Optics.
 * Giá tiền tính bằng VND nguyên (đồng) — tránh sai số số thực.
 */

export type Currency = "VND";

export type Category =
  | "camera"
  | "lens"
  | "lighting"
  | "tripod"
  | "storage"
  | "battery"
  | "bag"
  | "accessory";

export type Availability = "in_stock" | "low_stock" | "pre_order" | "out_of_stock" | "contact";

export interface ProductImage {
  url: string;
  alt: string;
}

/** Bộ thông số dùng để so sánh (compare) — thiếu thì ẩn hàng tương ứng. */
export type SpecKey =
  | "sensor"
  | "resolution"
  | "iso"
  | "autofocus"
  | "burst"
  | "video"
  | "ibis"
  | "battery"
  | "weight"
  | "dimensions"
  | "mount"
  | "focalLength"
  | "aperture"
  | "filterThread";

export type Specifications = Partial<Record<SpecKey, string>>;

export interface ProductVariant {
  id: string;
  sku: string;
  /** Nhãn hiển thị: "Body only", "Body + 50mm f/1.2", ... */
  name: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  availability: Availability;
  image?: ProductImage;
}

export interface Review {
  id: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  photos?: string[];
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: Category;
  subcategory: string;
  description: string;
  shortDescription: string;
  /** Giá cơ bản (variant rẻ nhất); variant có thể có giá riêng. */
  price: number;
  compareAtPrice?: number;
  /** Ngày kết thúc KM (ISO) — Offer priceValidUntil chỉ emit khi có sale + ngày tương lai. */
  saleEndsAt?: string;
  currency: Currency;
  stock: number;
  availability: Availability;
  images: ProductImage[];
  thumbnail: ProductImage;
  variants?: ProductVariant[];
  specifications: Specifications;
  rating: number;
  reviewCount: number;
  tags: string[];
  badges: string[];
  monthlyFrom?: number;
  createdAt: string;
  updatedAt: string;
  highlights?: string[];
  inTheBox?: string[];
  /** id sản phẩm phụ kiện đi kèm (complete your setup). */
  compatibleWith?: string[];
  reviews?: Review[];
}

export interface ProductQuery {
  brands?: string[];
  categories?: Category[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  search?: string;
  tags?: string[];
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export type SortOption =
  | "featured"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "rating_desc";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Facets {
  brands: { value: string; count: number }[];
  categories: { value: Category; count: number }[];
  priceRange: { min: number; max: number };
}

/* ---------- Cart ---------- */

export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
  addedAt: string;
}

/** Line đã resolve đầy đủ thông tin product/variant để render. */
export interface CartLineDetail extends CartLine {
  product: Product;
  variant?: ProductVariant;
  unitPrice: number;
  unitCompareAtPrice?: number;
  lineTotal: number;
  maxQuantity: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  savings: number;
  shipping: number;
  total: number;
  /** Còn bao nhiêu để được miễn phí vận chuyển (0 nếu đã đạt). */
  amountToFreeShipping: number;
  /** Giảm giá từ coupon (VND) — optional để tương thích snapshot cũ. */
  discount?: number;
  couponCode?: string;
}

export interface Coupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  active: boolean;
  expiresAt?: string;
}

export interface CartSnapshot {
  lines: CartLineDetail[];
  totals: CartTotals;
}

/* ---------- Wishlist / Compare ---------- */

export interface WishlistEntry {
  productId: string;
  /** Giá lúc thêm vào wishlist — dùng để phát hiện giảm giá. */
  priceAtAdd: number;
  addedAt: string;
}

export type CompareVerdict = "better" | "worse" | "same";

/* ---------- Checkout / Order ---------- */

export interface ContactInfo {
  fullName: string;
  email: string;
  phone: string;
}

export interface ShippingInfo {
  address: string;
  ward: string;
  district: string;
  city: string;
  notes?: string;
  /** Hóa đơn VAT (optional): đủ 3 trường thì xuất hóa đơn công ty. */
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
}

export type DeliveryMethod = "standard" | "express" | "pickup";

export type PaymentMethod = "bank_transfer" | "cod" | "card_on_delivery" | "vnpay";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderStep =
  | "order_placed"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered";

/**
 * SlimProduct — payload gọn cho search overlay + resolve cache (giỏ/wishlist).
 * Bỏ trường nặng ít dùng ở card/overlay: images[], description, specs,
 * highlights, inTheBox, compatibleWith, reviews. Merge vào cache full bằng
 * field-merge (giữ images/spec cũ) — xem mergeCatalogProducts.
 */
export type SlimProduct = Pick<
  Product,
  | "id" | "sku" | "slug" | "name" | "brand" | "category" | "subcategory"
  | "price" | "compareAtPrice" | "currency" | "stock" | "availability"
  | "thumbnail" | "rating" | "reviewCount" | "tags" | "badges"
  | "monthlyFrom" | "createdAt" | "updatedAt" | "variants"
>;

export interface OrderLine {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  image: string;
}

export type Carrier = "ghn" | "ghtk" | "manual";

export interface InvoiceInfo {
  companyName: string;
  taxCode: string;
  companyAddress: string;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  currentStep: OrderStep;
  contact: ContactInfo;
  shipping: ShippingInfo;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  lines: OrderLine[];
  totals: CartTotals;
  /** Vận đơn do admin nhập khi bàn giao cho đơn vị vận chuyển. */
  trackingCode?: string;
  carrier?: Carrier;
  /**
   * Token sở hữu đơn khách vãng lai — server trả đúng 1 lần lúc đặt hàng,
   * client lưu localStorage để xem/hủy/thanh toán. KHÔNG log token này.
   */
  guestToken?: string;
}

export const ORDER_STEP_ORDER: OrderStep[] = [
  "order_placed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

/* ---------- Auth ---------- */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Quyền (có từ getSessionUser; object dựng tay có thể thiếu → coi như non-admin). */
  role?: string;
}

/* ---------- Camera Finder ---------- */

export type PhotographyStyle =
  | "portrait"
  | "landscape"
  | "street"
  | "wildlife"
  | "sports"
  | "video"
  | "hybrid"
  | "travel";

export interface FinderAnswers {
  budget: "under_100m" | "100m_250m" | "250m_400m" | "above_400m";
  experience: "beginner" | "intermediate" | "professional";
  styles: PhotographyStyle[];
  sensorPreference: "fullframe" | "medium_format" | "apsc" | "any";
  sizePreference: "compact" | "balanced" | "performance";
  brandPreference?: string;
}

export interface FinderRecommendation {
  product: Product;
  score: number; // 0..1
  matchPercent: number; // 0..100
  reasons: string[];
  alternatives?: string[];
}

/* ---------- Recommendation ---------- */

export type RecommendationReason =
  | "similar"
  | "complete_setup"
  | "recently_viewed"
  | "same_brand"
  | "trending";

export interface Recommendation {
  product: Product;
  reason: RecommendationReason;
  label: string;
}
