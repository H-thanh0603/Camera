import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { createSession } from "./session";
import { createTotpChallenge } from "./two-factor";
import { logger } from "./logger";
import { logAudit } from "./audit";
import { fetchWithTimeout } from "./fetch";

/**
 * Đăng nhập Google OAuth2 (Authorization Code + PKCE S256).
 * User Google upsert theo email, session cookie httpOnly như login thường.
 * Tài khoản OAuth lưu passwordHash sentinel "oauth:google" — verifyPassword
 * luôn false nên không thể login bằng mật khẩu (muốn đặt mật khẩu: dùng
 * Quên mật khẩu). Tài khoản đã bật 2FA KHÔNG được session ngay — nhận
 * challenge bước 2 như login password (H1).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const OAUTH_STATE_COOKIE = "lumina.oauth_state";
export const OAUTH_VERIFIER_COOKIE = "lumina.oauth_verifier";
/** Challenge 2FA sau OAuth — httpOnly, callback set, account đọc 1 lần qua API. */
export const OAUTH_2FA_COOKIE = "lumina.oauth_2fa";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site}/api/auth/google/callback`;
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

function oauthCookieOpts(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  };
}

export async function beginGoogleLogin(): Promise<string> {
  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, oauthCookieOpts(600));
  store.set(OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOpts(600));
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public code: "BANNED" | "FAILED" = "FAILED",
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function finishGoogleLogin(
  code: string,
  state: string,
): Promise<{ isNewUser: boolean; challengeToken?: string }> {
  const store = await cookies();
  const expected = store.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = store.get(OAUTH_VERIFIER_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);
  store.delete(OAUTH_VERIFIER_COOKIE);
  if (!expected || !sameSecret(expected, state)) {
    throw new OAuthError("Phiên đăng nhập hết hạn. Vui lòng thử lại.");
  }
  if (!verifier) {
    throw new OAuthError("Phiên đăng nhập hết hạn. Vui lòng thử lại.");
  }

  const tokenRes = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }).toString(),
  });
  if (!tokenRes.ok) {
    logger.error("oauth.token_exchange_failed", { status: tokenRes.status });
    throw new OAuthError("Không xác thực được với Google. Vui lòng thử lại.");
  }
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) throw new OAuthError("Không xác thực được với Google. Vui lòng thử lại.");

  const meRes = await fetchWithTimeout(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) throw new OAuthError("Không lấy được thông tin Google. Vui lòng thử lại.");
  const info = (await meRes.json()) as GoogleUserInfo;
  if (!info.email_verified || !info.email) {
    throw new OAuthError("Email Google chưa được xác minh.");
  }
  const email = info.email.trim().toLowerCase();
  const name = info.name?.trim().slice(0, 80) || email.split("@")[0]!;

  let user = await prisma.user.findUnique({ where: { email } });
  let isNewUser = false;
  if (!user) {
    try {
      user = await prisma.user.create({
        data: { email, name, passwordHash: "oauth:google", role: "customer" },
      });
      isNewUser = true;
    } catch (e: unknown) {
      // Đua tạo cùng email (P2002) → đọc lại thay vì 500
      const { Prisma } = await import("@/generated/prisma/client");
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new OAuthError("Không tạo được tài khoản. Vui lòng thử lại.");
    }
  }
  if (user.isBanned) {
    logger.warn("oauth.banned_blocked", { userId: user.id });
    throw new OAuthError("Tài khoản đã bị khóa. Liên hệ concierge để được hỗ trợ.", "BANNED");
  }
  // Tài khoản bật 2FA: không session vội — trả challenge bước 2 (như login password).
  if (user.totpEnabled) {
    const challengeToken = await createTotpChallenge(user.id);
    const store2 = await cookies();
    store2.set(OAUTH_2FA_COOKIE, challengeToken, oauthCookieOpts(300));
    logger.info("oauth.google_2fa_required", { userId: user.id });
    await logAudit(
      { id: user.id, name: user.name, email: user.email },
      "auth.google_login_2fa_required",
      "User",
      user.id,
      { isNewUser },
    );
    return { isNewUser, challengeToken };
  }
  await createSession(user.id);
  logger.info("oauth.google_login", { userId: user.id, isNewUser });
  await logAudit(
    { id: user.id, name: user.name, email: user.email },
    "auth.google_login",
    "User",
    user.id,
    { isNewUser },
  );
  return { isNewUser };
}

/** Đọc challenge OAuth-2FA do callback set (account page poll 1 lần). */
export async function takeOAuth2faChallenge(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(OAUTH_2FA_COOKIE)?.value;
  if (token) store.delete(OAUTH_2FA_COOKIE);
  return token ?? null;
}
