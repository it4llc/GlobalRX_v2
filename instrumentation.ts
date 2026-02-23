// This file sets up instrumentation for monitoring and error tracking
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry for Node.js runtime
    const logger = await import("@/lib/logger").then(m => m.default);

    Sentry.init({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      environment: process.env.NODE_ENV,
      integrations: [
        Sentry.captureConsoleIntegration({
          levels: ["error", "warn"],
        }),
      ],
      beforeSend(event, hint) {
        if (process.env.NODE_ENV === "development" && !process.env.SENTRY_ENABLED) {
          return null;
        }

        // Log to Winston as well for redundancy
        if (event.level === "error" || event.level === "fatal") {
          logger.error("Sentry error captured", {
            eventId: event.event_id,
            message: event.message,
            level: event.level,
          });
        }

        // Remove PII from errors
        if (event.exception) {
          event.exception.values?.forEach((exception) => {
            if (exception.value) {
              exception.value = exception.value.replace(
                /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
                "[REDACTED_EMAIL]"
              );
              exception.value = exception.value.replace(
                /(Bearer\s+)[^\s]+/gi,
                "$1[REDACTED_TOKEN]"
              );
              exception.value = exception.value.replace(
                /(password[:\s=]+)[^\s]+/gi,
                "$1[REDACTED_PASSWORD]"
              );
            }
          });
        }

        // Scrub request data
        if (event.request) {
          if (event.request.headers) {
            delete event.request.headers["authorization"];
            delete event.request.headers["cookie"];
            delete event.request.headers["x-api-key"];
          }
          delete event.request.data;
        }

        // Scrub user data - only keep ID
        if (event.user) {
          event.user = { id: event.user.id };
        }

        return event;
      },
      ignoreErrors: [
        "ECONNRESET",
        "EPIPE",
        "ETIMEDOUT",
        "P2002",
        "P2025",
      ],
      profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for Edge runtime
    Sentry.init({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      environment: process.env.NODE_ENV,
      beforeSend(event, hint) {
        if (process.env.NODE_ENV === "development" && !process.env.SENTRY_ENABLED) {
          return null;
        }

        // Remove PII from errors
        if (event.exception) {
          event.exception.values?.forEach((exception) => {
            if (exception.value) {
              exception.value = exception.value.replace(
                /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
                "[REDACTED_EMAIL]"
              );
              exception.value = exception.value.replace(
                /(Bearer\s+)[^\s]+/gi,
                "$1[REDACTED_TOKEN]"
              );
            }
          });
        }

        return event;
      },
    });
  }
}