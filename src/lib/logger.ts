import winston from 'winston';

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Production configuration
const productionConfig: winston.LoggerOptions = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'globalrx',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'unknown'
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
};

// Development configuration
const developmentConfig: winston.LoggerOptions = {
  level: 'debug',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`;
    })
  ),
  defaultMeta: {
    service: 'globalrx',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console()
  ]
};

// Create logger instance
const logger = winston.createLogger(
  isProduction ? productionConfig : developmentConfig
);

// Add console transport in production for critical errors
if (isProduction) {
  logger.add(new winston.transports.Console({
    level: 'error',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for common logging patterns
export const logAuthEvent = (event: string, metadata: Record<string, any>) => {
  logger.info('Authentication event', {
    event,
    ...metadata,
    timestamp: Date.now()
  });
};

export const logAuthError = (reason: string, metadata: Record<string, any> = {}) => {
  logger.warn('Authentication failed', {
    event: 'auth_failure',
    reason,
    ...metadata,
    timestamp: Date.now()
  });
};

export const logPermissionDenied = (userId: string, resource: string, action: string, endpoint?: string) => {
  logger.warn('Permission denied', {
    event: 'permission_denied',
    userId,
    resource,
    action,
    endpoint,
    timestamp: Date.now()
  });
};

export const logDatabaseError = (operation: string, error: Error, userId?: string) => {
  logger.error('Database operation failed', {
    event: 'database_error',
    operation,
    error: error.message,
    stack: error.stack,
    userId,
    timestamp: Date.now()
  });
};

export const logApiRequest = (method: string, url: string, ip?: string, userAgent?: string) => {
  logger.info('API request', {
    event: 'api_request',
    method,
    url,
    ip,
    userAgent,
    timestamp: Date.now()
  });
};

export default logger;