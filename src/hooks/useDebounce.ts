"use client";

import { useEffect, useState } from "react";

/** Trả về giá trị sau khi người dùng ngừng gõ `delay` ms — dùng cho search. */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
