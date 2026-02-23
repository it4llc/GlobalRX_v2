"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-red-700 mb-4">
          Error Boundary Triggered! ✅
        </h2>
        <p className="text-gray-700 mb-4">
          This error was intentionally triggered to test the error boundary.
          The error has been captured and sent to Sentry.
        </p>
        <div className="bg-white rounded p-4 mb-4 font-mono text-sm">
          <p className="text-red-600">{error.message}</p>
          {error.digest && (
            <p className="text-gray-500 mt-2">Error ID: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Reset Test Page
        </button>
      </div>
    </div>
  );
}