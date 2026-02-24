// This file configures the initialization of Sentry for the client-side.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay session recording
  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs by default for privacy
      maskAllText: true,
      maskAllInputs: true,
      // Block all media to prevent recording sensitive images
      blockAllMedia: true,
    }),
  ],

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay sampling
  replaysSessionSampleRate: 0.01, // 1% of sessions recorded
  replaysOnErrorSampleRate: 0.5, // 50% of sessions with errors recorded

  // Set environment
  environment: process.env.NODE_ENV,

  // Filter out sensitive errors
  beforeSend(event, hint) {
    // Don't send errors in development unless explicitly enabled
    if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SENTRY_ENABLED) {
      return null;
    }

    // Remove any PII from error messages
    if (event.exception) {
      event.exception.values?.forEach((exception) => {
        if (exception.value) {
          // Redact email addresses
          exception.value = exception.value.replace(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
            "[REDACTED_EMAIL]"
          );
          // Redact potential tokens
          exception.value = exception.value.replace(
            /(Bearer\s+)[^\s]+/gi,
            "$1[REDACTED_TOKEN]"
          );
        }
      });
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    // Network errors that are expected
    /Failed to fetch/i,
    /NetworkError/i,
    /Load failed/i,
  ],
});