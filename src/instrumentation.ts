export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate critical environment variables on startup
    const required = [
      'DATABASE_URL',
      'JWT_SECRET',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'FIELD_ENCRYPTION_KEY',
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      console.error(
        `[STARTUP] Missing required environment variables: ${missing.join(', ')}. ` +
        'The application may not function correctly.'
      );
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
