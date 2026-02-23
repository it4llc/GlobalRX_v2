import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { hasPermission } from "@/lib/permission-utils";
import * as Sentry from "@sentry/nextjs";

interface StatusCheckResult {
  status: "operational" | "degraded" | "down";
  timestamp: string;
  environment: string;
  version?: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  services: {
    database: {
      status: "operational" | "degraded" | "down";
      latency?: number;
      connectionCount?: number;
      error?: string;
    };
    sentry?: {
      status: "operational" | "down";
      configured: boolean;
      error?: string;
    };
    authentication: {
      status: "operational" | "down";
      provider: string;
    };
  };
  stats?: {
    totalUsers?: number;
    totalCustomers?: number;
    totalPackages?: number;
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Detailed status endpoint for monitoring and debugging
 * Requires authentication and admin permissions for full details
 */
export async function GET(request: NextRequest) {
  const startTime = process.hrtime();

  // Check authentication
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user && hasPermission(session.user, "admin");

  const uptimeSeconds = process.uptime();
  const memUsage = process.memoryUsage();

  const result: StatusCheckResult = {
    status: "operational",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    services: {
      database: { status: "down" },
      authentication: {
        status: "operational",
        provider: "NextAuth",
      },
    },
  };

  try {
    // Database check
    const dbStart = process.hrtime();
    try {
      const [dbCheck, connectionCount] = await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        // Get connection pool stats if available
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM pg_stat_activity
          WHERE datname = current_database()
        `.catch(() => [{ count: 0n }]),
      ]);

      const dbEnd = process.hrtime(dbStart);
      const dbLatency = Math.round(dbEnd[0] * 1000 + dbEnd[1] / 1000000);

      result.services.database = {
        status: dbLatency > 1000 ? "degraded" : "operational",
        latency: dbLatency,
        connectionCount: Number(connectionCount[0]?.count || 0),
      };

      // Get stats if user is admin
      if (isAdmin) {
        const [userCount, customerCount, packageCount] = await Promise.all([
          prisma.user.count(),
          prisma.customer.count(),
          prisma.package.count(),
        ]);

        result.stats = {
          totalUsers: userCount,
          totalCustomers: customerCount,
          totalPackages: packageCount,
        };
      }
    } catch (dbError) {
      result.status = "down";
      result.services.database = {
        status: "down",
        error: isAdmin
          ? (dbError instanceof Error ? dbError.message : "Database connection failed")
          : "Database unavailable",
      };

      logger.error("Status check - database failure", {
        error: dbError instanceof Error ? dbError.message : "Unknown error",
      });
    }

    // Sentry check
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      try {
        const client = Sentry.getClient();
        result.services.sentry = {
          status: client ? "operational" : "down",
          configured: true,
        };
      } catch (sentryError) {
        result.services.sentry = {
          status: "down",
          configured: true,
          error: isAdmin
            ? (sentryError instanceof Error ? sentryError.message : "Sentry check failed")
            : "Error tracking unavailable",
        };
      }
    } else {
      result.services.sentry = {
        status: "down",
        configured: false,
      };
    }

    // Determine overall status
    if (result.services.database.status === "down") {
      result.status = "down";
    } else if (
      result.services.database.status === "degraded" ||
      result.services.sentry?.status === "down"
    ) {
      result.status = "degraded";
    }

    // Log status check (only issues in production)
    if (result.status !== "operational" || process.env.NODE_ENV !== "production") {
      logger.info("Status check completed", {
        status: result.status,
        services: result.services,
        authenticated: !!session,
        admin: isAdmin,
      });
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Status": result.status,
      },
    });
  } catch (error) {
    logger.error("Status check failure", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    result.status = "down";
    return NextResponse.json(result, {
      status: 500,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Status": "down",
      },
    });
  }
}