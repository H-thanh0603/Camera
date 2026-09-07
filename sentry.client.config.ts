/**
 * Sentry client — intentionally SDK-free (zero bundle cost).
 * Lỗi client chảy về /api/metrics → logger.error("client_error") → Sentry
 * ở phía server. File giữ lại để withSentryConfig không cảnh báo thiếu config.
 */
export const onRouterTransitionStart = () => undefined;
