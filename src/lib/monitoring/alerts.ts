import * as Sentry from "@sentry/nextjs";
import logger from "@/lib/logger";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  context?: Record<string, any>;
  error?: Error;
}

/**
 * Alert manager for sending notifications about critical system events
 * Currently integrated with Sentry and Winston logging
 * Can be extended to send to Slack, PagerDuty, email, etc.
 */
export class AlertManager {
  private static instance: AlertManager;

  private constructor() {}

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Send an alert through configured channels
   */
  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Log the alert
      this.logAlert(alert);

      // Send to Sentry based on severity
      this.sendToSentry(alert);

      // Send to external services if configured
      await this.sendToExternalServices(alert);
    } catch (error: unknown) {
      // Last resort logging if alert system fails
      logger.error("Failed to send alert", { error: error.message, alert: alert });
    }
  }

  /**
   * Send a critical alert for system failures
   */
  async criticalAlert(
    title: string,
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: "critical",
      error,
      context,
    });
  }

  /**
   * Send a warning alert for degraded performance or non-critical issues
   */
  async warningAlert(
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: "warning",
      context,
    });
  }

  /**
   * Send an info alert for important but non-urgent events
   */
  async infoAlert(
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: "info",
      context,
    });
  }

  /**
   * Log the alert using Winston
   */
  private logAlert(alert: Alert): void {
    const logData = {
      alert: true,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      context: alert.context,
      error: alert.error?.message,
      stack: alert.error?.stack,
      timestamp: new Date().toISOString(),
    };

    switch (alert.severity) {
      case "critical":
        logger.error("CRITICAL ALERT", logData);
        break;
      case "warning":
        logger.warn("WARNING ALERT", logData);
        break;
      case "info":
        logger.info("INFO ALERT", logData);
        break;
    }
  }

  /**
   * Send alert to Sentry
   */
  private sendToSentry(alert: Alert): void {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return;
    }

    const level = this.mapSeverityToSentryLevel(alert.severity);

    if (alert.error) {
      // Send as an exception if there's an error
      Sentry.withScope((scope) => {
        scope.setLevel(level);
        scope.setTag("alert", true);
        scope.setTag("alert.severity", alert.severity);
        scope.setContext("alert", {
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          ...alert.context,
        });
        Sentry.captureException(alert.error);
      });
    } else {
      // Send as a message if no error
      Sentry.withScope((scope) => {
        scope.setLevel(level);
        scope.setTag("alert", true);
        scope.setTag("alert.severity", alert.severity);
        scope.setContext("alert", {
          title: alert.title,
          severity: alert.severity,
          ...alert.context,
        });
        Sentry.captureMessage(alert.message, level);
      });
    }
  }

  /**
   * Send to external alerting services
   * This is where you'd integrate with Slack, PagerDuty, email, etc.
   */
  private async sendToExternalServices(alert: Alert): Promise<void> {
    // Slack webhook integration
    if (process.env.SLACK_WEBHOOK_URL && alert.severity === "critical") {
      await this.sendToSlack(alert);
    }

    // Email integration for critical alerts
    if (process.env.ALERT_EMAIL && alert.severity === "critical") {
      await this.sendEmail(alert);
    }

    // PagerDuty integration for critical alerts
    if (process.env.PAGERDUTY_ROUTING_KEY && alert.severity === "critical") {
      await this.sendToPagerDuty(alert);
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    if (!process.env.SLACK_WEBHOOK_URL) return;

    try {
      const color = this.getSeverityColor(alert.severity);
      const emoji = this.getSeverityEmoji(alert.severity);

      const payload = {
        attachments: [
          {
            color,
            title: `${emoji} ${alert.title}`,
            text: alert.message,
            fields: alert.context
              ? Object.entries(alert.context).map(([key, value]) => ({
                  title: key,
                  value: String(value),
                  short: true,
                }))
              : [],
            footer: "GlobalRx Alert System",
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error("Failed to send Slack alert", {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error: unknown) {
      logger.error("Error sending Slack alert", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send alert via email (placeholder for email service integration)
   */
  private async sendEmail(alert: Alert): Promise<void> {
    // This would integrate with SendGrid, AWS SES, or similar
    // For now, just log that we would send an email
    logger.info("Would send email alert", {
      to: process.env.ALERT_EMAIL,
      subject: alert.title,
      severity: alert.severity,
    });
  }

  /**
   * Send alert to PagerDuty
   */
  private async sendToPagerDuty(alert: Alert): Promise<void> {
    if (!process.env.PAGERDUTY_ROUTING_KEY) return;

    try {
      const payload = {
        routing_key: process.env.PAGERDUTY_ROUTING_KEY,
        event_action: "trigger",
        payload: {
          summary: `${alert.title}: ${alert.message}`,
          severity: this.mapSeverityToPagerDuty(alert.severity),
          source: "GlobalRx",
          custom_details: alert.context,
        },
      };

      const response = await fetch(
        "https://events.pagerduty.com/v2/enqueue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        logger.error("Failed to send PagerDuty alert", {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error: unknown) {
      logger.error("Error sending PagerDuty alert", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Map our severity levels to Sentry levels
   */
  private mapSeverityToSentryLevel(
    severity: AlertSeverity
  ): Sentry.SeverityLevel {
    switch (severity) {
      case "critical":
        return "fatal";
      case "warning":
        return "warning";
      case "info":
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Map our severity levels to PagerDuty severity
   */
  private mapSeverityToPagerDuty(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "critical";
      case "warning":
        return "warning";
      case "info":
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Get color for severity level (for Slack)
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "#FF0000"; // Red
      case "warning":
        return "#FFA500"; // Orange
      case "info":
        return "#0000FF"; // Blue
      default:
        return "#808080"; // Gray
    }
  }

  /**
   * Get emoji for severity level (for Slack)
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "🚨";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "📢";
    }
  }
}

// Export singleton instance
export const alertManager = AlertManager.getInstance();