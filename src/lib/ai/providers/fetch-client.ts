/**
 * Minimal typed fetch with timeout + abort that providers share.
 * Keeps provider adapters dependency-free (no SDK) and lets the timeout/error
 * behavior be consistent across every adapter.
 */

import {
  AuthError,
  ModelNotFoundError,
  ProviderUnavailableError,
  RateLimitError,
  TimeoutError,
  AbortedError,
} from "../errors";

export interface RawResponse {
  status: number;
  json: unknown;
}

export async function rawRequest(
  url: string,
  init: RequestInit & { timeoutMs?: number; signal?: AbortSignal },
): Promise<RawResponse> {
  const { timeoutMs = 30_000, signal, ...rest } = init;
  let timedOut = false;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  signal?.addEventListener("abort", onAbort);
  if (signal?.aborted) controller.abort();

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    let json: unknown = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  } catch (err) {
    if (signal?.aborted) throw new AbortedError();
    if (timedOut || (err instanceof Error && err.name === "AbortError")) throw new TimeoutError();
    throw new ProviderUnavailableError(undefined, { message: `Không kết nối được provider: ${(err as Error).message}` });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Map HTTP status to the provider-agnostic AIError subclasses. */
export function classifyHttpError(
  status: number,
  provider: string,
  model?: string,
  bodyMessage?: string,
): never {
  switch (status) {
    case 401:
    case 403:
      throw new AuthError(provider, bodyMessage, { status, model });
    case 429:
      throw new RateLimitError(provider, bodyMessage, { model });
    case 404:
      throw new ModelNotFoundError(provider, model);
    default:
      throw new ProviderUnavailableError(provider, { status, message: bodyMessage, model });
  }
}

export function errorMessageOf(json: unknown): string {
  if (!json || typeof json !== "object") return "Provider trả lỗi không xác định.";
  const any = json as Record<string, unknown>;
  const err = any.error as Record<string, unknown> | undefined;
  if (err && typeof err.message === "string") return err.message;
  if (typeof any.message === "string") return any.message;
  if (typeof any.error === "string") return any.error;
  return "Provider trả lỗi không xác định.";
}