// src/lib/client-logger.ts
// Client-safe logging wrapper that filters out sensitive data

interface LogMeta {
  [key: string]: any;
}

// Sensitive data patterns to filter out
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /session/i,
  /cookie/i,
  /email/i,
  /phone/i,
  /ssn/i,
  /social/i,
];

// Email pattern to detect and filter email addresses
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Filter sensitive data from objects and strings
function filterSensitiveData(data: any): any {
  if (typeof data === 'string') {
    // Replace email addresses with [EMAIL_FILTERED]
    return data.replace(EMAIL_PATTERN, '[EMAIL_FILTERED]');
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(filterSensitiveData);
    }

    const filtered: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key contains sensitive patterns
      const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));

      if (isSensitiveKey) {
        filtered[key] = '[FILTERED]';
      } else {
        filtered[key] = filterSensitiveData(value);
      }
    }
    return filtered;
  }

  return data;
}

// Safe logging interface that mimics Winston but works on client-side
export const clientLogger = {
  debug: (message: string, meta?: LogMeta) => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const filteredMeta = meta ? filterSensitiveData(meta) : undefined;
      console.debug(`[DEBUG] ${filterSensitiveData(message)}`, filteredMeta);
    }
  },

  info: (message: string, meta?: LogMeta) => {
    if (typeof window !== 'undefined') {
      const filteredMeta = meta ? filterSensitiveData(meta) : undefined;
      if (process.env.NODE_ENV === 'development') {
        console.info(`[INFO] ${filterSensitiveData(message)}`, filteredMeta);
      }
    }
  },

  warn: (message: string, meta?: LogMeta) => {
    if (typeof window !== 'undefined') {
      const filteredMeta = meta ? filterSensitiveData(meta) : undefined;
      console.warn(`[WARN] ${filterSensitiveData(message)}`, filteredMeta);
    }
  },

  error: (message: string, meta?: LogMeta) => {
    if (typeof window !== 'undefined') {
      const filteredMeta = meta ? filterSensitiveData(meta) : undefined;
      console.error(`[ERROR] ${filterSensitiveData(message)}`, filteredMeta);
    }
  }
};

// Convenience function to get the appropriate logger
export function getLogger() {
  // Check if we're in a server environment where Winston is available
  if (typeof window === 'undefined') {
    try {
      // Import Winston logger for server-side usage
      return require('@/lib/logger').default;
    } catch {
      // Fallback if Winston import fails
      return clientLogger;
    }
  }

  // Return client-safe logger for browser environment
  return clientLogger;
}

export default clientLogger;