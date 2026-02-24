import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import logger from "@/lib/logger";
import { alertManager } from "@/lib/monitoring";

/**
 * Test endpoint for verifying error tracking and alerting
 * This endpoint intentionally throws errors for testing purposes
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "basic";

  try {
    switch (type) {
      case "basic":
        // Basic error that should be caught and logged
        throw new Error("Test API error - basic error for monitoring test");

      case "critical":
        // Trigger a critical alert
        await alertManager.criticalAlert(
          "Test Critical Alert",
          "This is a test critical alert from the monitoring test page",
          new Error("Test critical error"),
          { source: "test-error-endpoint", timestamp: new Date() }
        );
        return NextResponse.json(
          { error: "Critical alert sent" },
          { status: 500 }
        );

      case "warning":
        // Trigger a warning alert
        await alertManager.warningAlert(
          "Test Warning Alert",
          "This is a test warning alert from the monitoring test page",
          { source: "test-error-endpoint", level: "warning" }
        );
        return NextResponse.json(
          { error: "Warning alert sent" },
          { status: 400 }
        );

      case "database":
        // Simulate database error
        throw new Error("Database connection lost (simulated)");

      default:
        throw new Error(`Unknown error type: ${type}`);
    }
  } catch (error: unknown) {
    // Log error with Winston
    logger.error("Test error endpoint triggered", {
      type,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Capture with Sentry
    Sentry.captureException(error, {
      tags: {
        test: true,
        errorType: type,
      },
      extra: {
        endpoint: "/api/test-error",
        timestamp: new Date().toISOString(),
      },
    });

    // Return error response
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        type,
        message: "This is a test error - monitoring systems should have captured this",
      },
      { status: 500 }
    );
  }
}