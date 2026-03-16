export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate critical environment variables on startup
    const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
    const recommended = [
      'FIELD_ENCRYPTION_KEY', 'CSRF_SECRET', 'JWT_SECRET',
      'GOOGLE_CLIENT_ID', 'STRIPE_SECRET_KEY',
      'UPSTASH_REDIS_REST_URL',
    ];

    const missing = required.filter((key) => !process.env[key]);
    const missingRecommended = recommended.filter((key) => !process.env[key]);

    if (missingRecommended.length > 0) {
      console.warn(
        `[STARTUP] Missing recommended env vars: ${missingRecommended.join(', ')}. Some features may not work.`
      );
    }

    if (missing.length > 0) {
      const message = `[STARTUP] Missing REQUIRED env vars: ${missing.join(', ')}. App cannot start safely.`;
      console.error(message);
      if (process.env.NODE_ENV === 'production' && process.env.SKIP_ENV_VALIDATION !== 'true') {
        throw new Error(message);
      }
    }

    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error -- Sentry types may not match exactly
  return Sentry.captureRequestError(...args);
};
