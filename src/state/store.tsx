"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CartLine, CartSnapshot, Product, SessionUser, WishlistEntry } from "@/lib/types";
import { buildCartSnapshot, clampQuantity, mergeLine, resolveVariant, unitPriceOf } from "@/lib/services/cart-service";
import { getProductById, setCatalogProducts } from "@/lib/repositories/product-repository";
import { loadJSON, saveJSON } from "@/lib/repositories/storage-repository";
import { apiLogin, apiLogout, apiMe, apiRegister } from "@/lib/api-client";
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
  | { type: "catalog/refresh" };

const lineKey = (l: { productId: string; variantId?: string }) => `${l.productId}::${l.variantId ?? ""}`;

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
  register: (name: string, email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  dismissToast: (id: number) => void;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
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
  });
  const [hydrated, setHydrated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const toastId = useRef(0);

  // Hydrate từ localStorage sau mount — tránh mismatch SSR.
  useEffect(() => {
    dispatch({
      type: "hydrate",
      state: {
        cart: loadJSON<CartLine[]>("cart", []),
        wishlist: loadJSON<WishlistEntry[]>("wishlist", []),
        compare: loadJSON<string[]>("compare", []),
        recent: loadJSON<string[]>("recent", []),
      },
    });
    setHydrated(true);
    // Phiên đăng nhập nằm trong cookie httpOnly — xác thực qua server
    apiMe()
      .then((user) => dispatch({ type: "auth/set", user }))
      .catch(() => dispatch({ type: "auth/set", user: null }))
      .finally(() => setAuthLoading(false));

    // Làm mới catalogue từ DB (giá/stock do admin quản trị) — seed chỉ là snapshot ban đầu
    fetch("/api/products/snapshot")
      .then((r) => r.json())
      .then((data: { products?: import("@/lib/types").Product[] }) => {
        if (Array.isArray(data.products) && data.products.length > 0) {
          setCatalogProducts(data.products);
          dispatch({ type: "catalog/refresh" });
        }
      })
      .catch(() => undefined);
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
        const u = await apiLogin(email, password);
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
    };
  }, [hydrated, state, authLoading, cartSnapshot, toasts, cartDrawerOpen, searchOpen, pushToast, dismissToast]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore phải được dùng bên trong <StoreProvider>");
  return ctx;
}
