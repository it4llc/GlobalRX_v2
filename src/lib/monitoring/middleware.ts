import { NextRequest, NextResponse } from "next/server";
import { alertManager } from "./alerts";
import logger from "@/lib/logger";

interface RequestMetrics {
  startTime: number;
  path: string;
  method: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
}

// Track request metrics in memory (would use Redis in production)
const requestMetrics = new Map<string, RequestMetrics[]>();
const METRICS_WINDOW = 60000; // 1 minute window
const ERROR_RATE_THRESHOLD = 0.1; // 10% error rate triggers alert
const SLOW_REQUEST_THRESHOLD = 5000; // 5 seconds

/**
 * Monitoring middleware to track request metrics and send alerts
 */
export async function monitoringMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now();
  const path = request.nextUrl.pathname;
  const method = request.method;

  const metrics: RequestMetrics = {
    startTime,
    path,
    method,
  };

  try {
    // Execute the actual request handler
    const response = await handler();

    // Record metrics
    metrics.statusCode = response.status;
    metrics.duration = Date.now() - startTime;

    // Check for slow requests
    if (metrics.duration > SLOW_REQUEST_THRESHOLD) {
      await alertManager.warningAlert(
        "Slow Request Detected",
        `Request to ${method} ${path} took ${metrics.duration}ms`,
        {
          path,
          method,
          duration: metrics.duration,
          statusCode: metrics.statusCode,
        }
      );
    }

    // Check for server errors
    if (response.status >= 500) {
      await alertManager.criticalAlert(
        "Server Error",
        `${response.status} error on ${method} ${path}`,
        undefined,
        {
          path,
          method,
          statusCode: response.status,
          duration: metrics.duration,
        }
      );
    }

    // Store metrics for rate calculation
    storeMetrics(path, metrics);

    // Check error rates
    await checkErrorRates(path);

    return response;
  } catch (error: unknown) {
    // Record error metrics
    metrics.error = error instanceof Error ? error : new Error("Unknown error");
    metrics.duration = Date.now() - startTime;
    metrics.statusCode = 500;

    // Store metrics
    storeMetrics(path, metrics);

    // Send critical alert for unhandled errors
    await alertManager.criticalAlert(
      "Unhandled Request Error",
      `Critical error in ${method} ${path}`,
      metrics.error,
      {
        path,
        method,
        duration: metrics.duration,
      }
    );

    // Check error rates
    await checkErrorRates(path);

    // Re-throw the error
    throw error;
  }
}

/**
 * Store request metrics for rate calculations
 */
function storeMetrics(path: string, metrics: RequestMetrics): void {
  if (!requestMetrics.has(path)) {
    requestMetrics.set(path, []);
  }

  const pathMetrics = requestMetrics.get(path)!;
  pathMetrics.push(metrics);

  // Clean up old metrics outside the window
  const cutoff = Date.now() - METRICS_WINDOW;
  const filtered = pathMetrics.filter((m) => m.startTime > cutoff);
  requestMetrics.set(path, filtered);
}

/**
 * Check error rates and send alerts if threshold exceeded
 */
async function checkErrorRates(path: string): Promise<void> {
  const pathMetrics = requestMetrics.get(path);
  if (!pathMetrics || pathMetrics.length < 10) {
    // Need at least 10 requests to calculate meaningful rate
    return;
  }

  const errorCount = pathMetrics.filter(
    (m) => m.statusCode && m.statusCode >= 500
  ).length;
  const errorRate = errorCount / pathMetrics.length;

  if (errorRate > ERROR_RATE_THRESHOLD) {
    await alertManager.criticalAlert(
      "High Error Rate Detected",
      `Error rate for ${path} is ${(errorRate * 100).toFixed(1)}%`,
      undefined,
      {
        path,
        errorRate: errorRate * 100,
        totalRequests: pathMetrics.length,
        errorCount,
        window: "1 minute",
      }
    );
  }
}

/**
 * Monitor database connection health
 */
export async function monitorDatabaseHealth(
  checkFn: () => Promise<boolean>
): Promise<void> {
  try {
    const isHealthy = await checkFn();

    if (!isHealthy) {
      await alertManager.criticalAlert(
        "Database Connection Lost",
        "Unable to connect to the database",
        undefined,
        {
          service: "database",
          timestamp: new Date().toISOString(),
        }
      );
    }
  } catch (error: unknown) {
    await alertManager.criticalAlert(
      "Database Health Check Failed",
      "Error while checking database health",
      error instanceof Error ? error : new Error("Unknown error"),
      {
        service: "database",
        timestamp: new Date().toISOString(),
      }
    );
  }
}

/**
 * Monitor critical business operations
 */
export async function monitorCriticalOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    // Alert on slow operations
    if (duration > SLOW_REQUEST_THRESHOLD) {
      await alertManager.warningAlert(
        `Slow Operation: ${operationName}`,
        `Operation took ${duration}ms to complete`,
        {
          operation: operationName,
          duration,
          ...context,
        }
      );
    }

    // Log successful critical operations
    logger.info(`Critical operation completed: ${operationName}`, {
      operation: operationName,
      duration,
      ...context,
    });

    return result;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    // Send critical alert for failed operations
    await alertManager.criticalAlert(
      `Critical Operation Failed: ${operationName}`,
      `Operation failed after ${duration}ms`,
      error instanceof Error ? error : new Error("Unknown error"),
      {
        operation: operationName,
        duration,
        ...context,
      }
    );

    throw error;
  }
}

/**
 * Setup periodic health checks
 */
export function setupPeriodicHealthChecks(): void {
  // Check system health every 5 minutes
  setInterval(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/health`,
        {
          method: "GET",
          headers: { "User-Agent": "GlobalRx-HealthCheck" },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        await alertManager.criticalAlert(
          "Health Check Failed",
          `Health check returned status ${response.status}`,
          undefined,
          {
            status: response.status,
            data,
          }
        );
      }
    } catch (error: unknown) {
      await alertManager.criticalAlert(
        "Health Check Error",
        "Unable to perform health check",
        error instanceof Error ? error : new Error("Unknown error")
      );
    }
  }, 5 * 60 * 1000); // 5 minutes
}