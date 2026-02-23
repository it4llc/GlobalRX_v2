/**
 * Monitoring and alerting exports
 *
 * Usage in API routes:
 * ```typescript
 * import { alertManager, monitorCriticalOperation } from "@/lib/monitoring";
 *
 * // Send an alert
 * await alertManager.criticalAlert("Database Error", "Failed to save order", error);
 *
 * // Monitor a critical operation
 * const result = await monitorCriticalOperation(
 *   "ProcessOrder",
 *   async () => await processOrder(orderId),
 *   { orderId }
 * );
 * ```
 */

export { alertManager, type Alert, type AlertSeverity } from "./alerts";
export {
  monitoringMiddleware,
  monitorDatabaseHealth,
  monitorCriticalOperation,
  setupPeriodicHealthChecks,
} from "./middleware";

// Re-export Sentry for convenience
export * as Sentry from "@sentry/nextjs";