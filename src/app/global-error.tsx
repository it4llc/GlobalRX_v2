"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-4xl font-bold">Something went wrong!</h1>
            <p className="mb-4 text-gray-600">
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p className="mb-4 text-sm text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}