/**
 * StorageRepository — lớp bọc localStorage với xử lý lỗi và SSR-safe.
 * Mọi persistence của client (cart, wishlist, auth, orders, recent, search)
 * đi qua đây để sau này đổi sang IndexedDB hoặc API mà không sửa UI.
 */

const PREFIX = "lumina.";

export function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback; // dữ liệu hỏng → bỏ qua, không phá vỡ app
  }
}

export function saveJSON(key: string, value: unknown): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded / private mode — im lặng, persistence là best-effort
  }
}

export function removeKey(key: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* best-effort */
  }
}
