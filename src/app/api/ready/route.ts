import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

interface ReadinessCheckResult {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    migrations?: boolean;
    requiredEnvVars: boolean;
  };
  details?: {
    missingEnvVars?: string[];
    migrationStatus?: string;
  };
}

/**
 * Readiness check endpoint for Kubernetes/container orchestration
 * Returns 200 if the application is ready to serve traffic
 * Returns 503 if the application is not ready
 *
 * This is different from /health which checks if the app is running
 * Readiness checks if the app is ready to handle requests
 */
export async function GET() {
  const result: ReadinessCheckResult = {
    ready: true,
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      requiredEnvVars: false,
    },
    details: {},
  };

  try {
    // Check required environment variables
    const requiredEnvVars = [
      "DATABASE_URL",
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length === 0) {
      result.checks.requiredEnvVars = true;
    } else {
      result.ready = false;
      result.details!.missingEnvVars = missingEnvVars;
      logger.error("Readiness check failed - missing environment variables", {
        missingEnvVars,
      });
    }

    // Check database connection and readiness
    try {
      // Simple connectivity check
      await prisma.$queryRaw`SELECT 1`;

      // Check if migrations have been run by verifying a critical table exists
      try {
        await prisma.user.findFirst({
          take: 1,
          select: { id: true },
        });
        result.checks.database = true;
        result.checks.migrations = true;
      } catch (migrationError) {
        // Database is up but migrations might not be complete
        result.checks.database = true;
        result.checks.migrations = false;
        result.ready = false;
        result.details!.migrationStatus = "Migrations may be incomplete";

        logger.error("Readiness check - migrations incomplete", {
          error: migrationError instanceof Error ? migrationError.message : "Unknown error",
        });
      }
    } catch (dbError: unknown) {
      result.ready = false;
      result.checks.database = false;

      logger.error("Readiness check failed - database connection", {
        error: dbError instanceof Error ? dbError.message : "Unknown error",
      });
    }

    // Log readiness status (only failures in production)
    if (!result.ready || process.env.NODE_ENV !== "production") {
      logger.info("Readiness check completed", {
        ready: result.ready,
        checks: result.checks,
        details: result.details,
      });
    }

    // Return appropriate status code
    const statusCode = result.ready ? 200 : 503;

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Ready-Status": result.ready ? "ready" : "not-ready",
      },
    });
  } catch (error: unknown) {
    // Catastrophic failure
    logger.error("Readiness check catastrophic failure", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    result.ready = false;
    return NextResponse.json(result, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Ready-Status": "not-ready",
      },
    });
  }
}