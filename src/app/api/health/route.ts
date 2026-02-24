import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: "healthy" | "unhealthy";
      responseTime?: number;
      error?: string;
    };
    sentry?: {
      status: "healthy" | "unhealthy";
      error?: string;
    };
  };
  environment: string;
  version?: string;
}

/**
 * Health check endpoint for monitoring service health
 * Returns 200 if all critical services are healthy
 * Returns 503 if any critical service is unhealthy
 * Returns 200 with degraded status if non-critical services are unhealthy
 */
export async function GET() {
  const startTime = process.hrtime();
  const result: HealthCheckResult = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "unhealthy" },
    },
    environment: process.env.NODE_ENV || "development",
    version: process.env.NEXT_PUBLIC_APP_VERSION,
  };

  try {
    // Check database connectivity
    const dbStartTime = process.hrtime();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbEndTime = process.hrtime(dbStartTime);
      const dbResponseTime = dbEndTime[0] * 1000 + dbEndTime[1] / 1000000;

      result.checks.database = {
        status: "healthy",
        responseTime: Math.round(dbResponseTime),
      };
    } catch (error: unknown) {
      result.status = "unhealthy";
      result.checks.database = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Database connection failed",
      };

      logger.error("Health check failed - database", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Check Sentry connectivity (non-critical)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      try {
        // Verify Sentry is initialized
        const client = Sentry.getClient();
        if (client) {
          result.checks.sentry = { status: "healthy" };
        } else {
          result.checks.sentry = {
            status: "unhealthy",
            error: "Sentry client not initialized",
          };
          // Non-critical service, so we only degrade status
          if (result.status === "healthy") {
            result.status = "degraded";
          }
        }
      } catch (error: unknown) {
        result.checks.sentry = {
          status: "unhealthy",
          error: error instanceof Error ? error.message : "Sentry check failed",
        };
        // Non-critical service, so we only degrade status
        if (result.status === "healthy") {
          result.status = "degraded";
        }
      }
    }

    // Calculate total response time
    const endTime = process.hrtime(startTime);
    const totalTime = endTime[0] * 1000 + endTime[1] / 1000000;

    // Log health check (only log failures and degraded states in production)
    if (result.status !== "healthy" || process.env.NODE_ENV !== "production") {
      logger.info("Health check completed", {
        status: result.status,
        responseTime: Math.round(totalTime),
        checks: result.checks,
      });
    }

    // Return appropriate status code based on health
    const statusCode = result.status === "unhealthy" ? 503 : 200;

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": result.status,
      },
    });
  } catch (error: unknown) {
    // Catastrophic failure
    logger.error("Health check catastrophic failure", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    result.status = "unhealthy";
    return NextResponse.json(result, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": "unhealthy",
      },
    });
  }
}