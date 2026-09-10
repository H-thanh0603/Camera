"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CartLine, CartSnapshot, Product, SessionUser, WishlistEntry } from "@/lib/types";
import { buildCartSnapshot, clampQuantity, mergeLine, resolveVariant, unitPriceOf } from "@/lib/services/cart-service";
import { getProductById } from "@/lib/repositories/product-repository";
import { loadJSON, saveJSON } from "@/lib/repositories/storage-repository";
import { apiLogin, apiLogout, apiMe, apiRegister, apiResolveProducts } from "@/lib/api-client";
import { track } from "@/lib/analytics";

/* ================= Toast ================= */

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  action?: { label: string; href: string };
}

/* ================= State shape ================= */

interface AppState {
  cart: CartLine[];
  wishlist: WishlistEntry[];
  compare: string[];
  recent: string[];
  user: SessionUser | null;
  catalogVersion: number;
  theme: "dark" | "light";
}

type Action =
  | { type: "hydrate"; state: Partial<AppState> }
  | { type: "cart/add"; line: CartLine }
  | { type: "cart/setQuantity"; productId: string; variantId?: string; quantity: number }
  | { type: "cart/remove"; productId: string; variantId?: string }
  | { type: "cart/clear" }
  | { type: "wishlist/toggle"; product: Product }
  | { type: "wishlist/remove"; productId: string }
  | { type: "compare/toggle"; productId: string }
  | { type: "compare/remove"; productId: string }
  | { type: "recent/add"; productId: string }
  | { type: "auth/set"; user: SessionUser | null }
  | { type: "catalog/refresh" }
  | { type: "theme/set"; theme: "dark" | "light" };

const lineKey = (l: { productId: string; variantId?: string }) => `${l.productId}::${l.variantId ?? ""}`;

/** Đồng bộ class theme lên <html> (dark = mặc định, light = .light). */
function applyThemeClass(theme: "dark" | "light"): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state };
    case "cart/add":
      return { ...state, cart: mergeLine(state.cart, action.line, getProductById) };
    case "cart/setQuantity": {
      const product = getProductById(action.productId);
      if (!product) return state;
      const clamped = clampQuantity(product, action.variantId, action.quantity);
      return {
        ...state,
        cart: state.cart.map((l) =>
          lineKey(l) === lineKey(action) && clamped !== null ? { ...l, quantity: clamped } : l,
        ),
      };
    }
    case "cart/remove":
      return { ...state, cart: state.cart.filter((l) => lineKey(l) !== lineKey(action)) };
    case "cart/clear":
      return { ...state, cart: [] };
    case "wishlist/toggle": {
      const exists = state.wishlist.some((w) => w.productId === action.product.id);
      if (exists) {
        return { ...state, wishlist: state.wishlist.filter((w) => w.productId !== action.product.id) };
      }
      if (state.wishlist.length >= 20) return state;
      return {
        ...state,
        wishlist: [
          { productId: action.product.id, priceAtAdd: action.product.price, addedAt: new Date().toISOString() },
          ...state.wishlist,
        ],
      };
    }
    case "wishlist/remove":
      return { ...state, wishlist: state.wishlist.filter((w) => w.productId !== action.productId) };
    case "compare/toggle": {
      const exists = state.compare.includes(action.productId);
      if (exists) return { ...state, compare: state.compare.filter((id) => id !== action.productId) };
      if (state.compare.length >= 4) return state; // giới hạn 2–4 sản phẩm
      return { ...state, compare: [...state.compare, action.productId] };
    }
    case "compare/remove":
      return { ...state, compare: state.compare.filter((id) => id !== action.productId) };
    case "recent/add": {
      // No-op nếu đã ở đầu danh sách — tránh tạo state mới gây re-render vòng lặp
      if (state.recent[0] === action.productId) return state;
      return { ...state, recent: [action.productId, ...state.recent.filter((id) => id !== action.productId)].slice(0, 12) };
    }
    case "auth/set":
      return { ...state, user: action.user };
    case "catalog/refresh":
      return { ...state, catalogVersion: state.catalogVersion + 1 };
    case "theme/set":
      return { ...state, theme: action.theme };
    default:
      return state;
  }
}

/* ================= Context ================= */

interface StoreContextValue {
  hydrated: boolean;
  cart: CartLine[];
  cartSnapshot: CartSnapshot;
  addToCart: (product: Product, variantId?: string, quantity?: number) => boolean;
  setQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => void;
  wishlist: WishlistEntry[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: Product) => void;
  removeWishlist: (productId: string) => void;
  compare: string[];
  isCompared: (productId: string) => boolean;
  toggleCompare: (productId: string) => void;
  compareLimitReached: boolean;
  recent: string[];
  trackView: (productId: string) => void;
  user: SessionUser | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  verify2fa: (challengeToken: string, code: string) => Promise<SessionUser>;
  register: (name: string, email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  dismissToast: (id: number) => void;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    cart: [],
    wishlist: [],
    compare: [],
    recent: [],
    user: null,
    catalogVersion: 0,
    theme: "dark",
  });
  const [hydrated, setHydrated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const toastId = useRef(0);

  // Hydrate từ localStorage sau mount — tránh mismatch SSR.
  useEffect(() => {
    const savedTheme = loadJSON<"dark" | "light">("theme", "dark");
    const theme = savedTheme === "light" ? "light" : "dark";
    dispatch({ type: "hydrate", state: { theme } });
    applyThemeClass(theme);
    const cart = loadJSON<CartLine[]>("cart", []);
    const wishlist = loadJSON<WishlistEntry[]>("wishlist", []);
    const compare = loadJSON<string[]>("compare", []);
    const recent = loadJSON<string[]>("recent", []);
    dispatch({ type: "hydrate", state: { cart, wishlist, compare, recent } });
    setHydrated(true);
    // Phiên đăng nhập nằm trong cookie httpOnly — xác thực qua server
    apiMe()
      .then((user) => dispatch({ type: "auth/set", user }))
      .catch(() => dispatch({ type: "auth/set", user: null }))
      .finally(() => setAuthLoading(false));

    // Làm mới giá/stock ĐÚNG các SP user đang giữ (giỏ/wishlist/compare/recent)
    // từ DB — bounded ~60 ids, không tải toàn bộ catalogue (scale nghìn SKU).
    const ids = [
      ...cart.map((l) => l.productId),
      ...wishlist.map((w) => w.productId),
      ...compare,
      ...recent,
    ];
    if (ids.length > 0) {
      apiResolveProducts(ids)
        .then((products) => {
          if (products.length > 0) dispatch({ type: "catalog/refresh" });
        })
        .catch(() => undefined);
    }
  }, []);

  // Persist khi thay đổi (chỉ sau khi hydrate xong)
  useEffect(() => {
    if (hydrated) saveJSON("cart", state.cart);
  }, [state.cart, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON("wishlist", state.wishlist);
  }, [state.wishlist, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON("compare", state.compare);
  }, [state.compare, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON("recent", state.recent);
  }, [state.recent, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    saveJSON("theme", state.theme);
    applyThemeClass(state.theme);
  }, [state.theme, hydrated]);

  const cartSnapshot = useMemo(
    () => buildCartSnapshot(state.cart, getProductById),
    [state.cart],
  );

  const pushToast = useCallback((message: string, tone: Toast["tone"] = "success", action?: Toast["action"]) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const value = useMemo<StoreContextValue>(() => {
    return {
      hydrated,
      cart: state.cart,
      cartSnapshot,
      addToCart: (product, variantId, quantity = 1) => {
        const clamped = clampQuantity(product, variantId, quantity);
        if (clamped === null) {
          pushToast("Sản phẩm hiện không thể mua trực tuyến. Vui lòng liên hệ concierge.", "error");
          return false;
        }
        dispatch({ type: "cart/add", line: { productId: product.id, variantId, quantity: clamped, addedAt: new Date().toISOString() } });
        track("add_to_cart", { productId: product.id, variantId: variantId ?? null, quantity: clamped, price: unitPriceOf(product, resolveVariant(product, variantId)) });
        pushToast(`Đã thêm "${product.name}" vào giỏ hàng.`, "success", { label: "Xem giỏ", href: "/cart" });
        setCartDrawerOpen(true);
        return true;
      },
      setQuantity: (productId, variantId, quantity) => dispatch({ type: "cart/setQuantity", productId, variantId, quantity }),
      removeFromCart: (productId, variantId) => {
        dispatch({ type: "cart/remove", productId, variantId });
        pushToast("Đã xóa sản phẩm khỏi giỏ hàng.", "info");
      },
      clearCart: () => dispatch({ type: "cart/clear" }),
      wishlist: state.wishlist,
      isWishlisted: (productId) => state.wishlist.some((w) => w.productId === productId),
      toggleWishlist: (product) => {
        const wasWishlisted = state.wishlist.some((w) => w.productId === product.id);
        if (!wasWishlisted && state.wishlist.length >= 20) {
          pushToast("Wishlist đã đầy (tối đa 20 sản phẩm).", "error");
          return;
        }
        dispatch({ type: "wishlist/toggle", product });
        pushToast(wasWishlisted ? `Đã bỏ "${product.name}" khỏi yêu thích.` : `Đã lưu "${product.name}" vào yêu thích.`, "info", { label: "Xem wishlist", href: "/wishlist" });
      },
      removeWishlist: (productId) => dispatch({ type: "wishlist/remove", productId }),
      compare: state.compare,
      isCompared: (productId) => state.compare.includes(productId),
      toggleCompare: (productId) => {
        if (!state.compare.includes(productId) && state.compare.length >= 4) {
          pushToast("Chỉ có thể so sánh tối đa 4 sản phẩm.", "error", { label: "Xem so sánh", href: "/compare" });
          return;
        }
        dispatch({ type: "compare/toggle", productId });
        pushToast("Đã cập nhật danh sách so sánh.", "info", { label: "Xem so sánh", href: "/compare" });
      },
      compareLimitReached: state.compare.length >= 4,
      recent: state.recent,
      trackView: (productId) => dispatch({ type: "recent/add", productId }),
      user: state.user,
      authLoading,
      login: async (email, password) => {
        const result = await apiLogin(email, password);
        if ("twoFactorRequired" in result) {
          // Tài khoản bật 2FA — UI chuyển sang form nhập code (xem AccountPage).
          throw { twoFactorRequired: true, challengeToken: result.challengeToken };
        }
        dispatch({ type: "auth/set", user: result.user });
        return result.user;
      },
      verify2fa: async (challengeToken, code) => {
        const { apiVerify2fa } = await import("@/lib/api-client");
        const u = await apiVerify2fa(challengeToken, code);
        dispatch({ type: "auth/set", user: u });
        return u;
      },
      register: async (name, email, password) => {
        const u = await apiRegister(name, email, password);
        dispatch({ type: "auth/set", user: u });
        return u;
      },
      logout: () => {
        apiLogout().catch(() => undefined);
        dispatch({ type: "auth/set", user: null });
        pushToast("Đã đăng xuất.", "info");
      },
      toasts,
      pushToast,
      dismissToast,
      cartDrawerOpen,
      setCartDrawerOpen,
      searchOpen,
      setSearchOpen,
      theme: state.theme,
      toggleTheme: () => dispatch({ type: "theme/set", theme: state.theme === "dark" ? "light" : "dark" }),
    };
  }, [hydrated, state, authLoading, cartSnapshot, toasts, cartDrawerOpen, searchOpen, pushToast, dismissToast]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore phải được dùng bên trong <StoreProvider>");
  return ctx;
}
