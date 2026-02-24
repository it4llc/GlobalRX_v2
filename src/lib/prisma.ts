// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import logger from '@/lib/logger';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: 
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a connection timeout function
const connectWithTimeout = async (prismaClient: PrismaClient, timeoutMs = 5000) => {
  let isConnected = false;
  
  // Try to connect
  const connectionPromise = prismaClient.$connect()
    .then(() => {
      isConnected = true;
      logger.info('Successfully connected to the database');
      return true;
    })
    .catch((error) => {
      logger.error('Failed to connect to the database', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    });

  // Create a timeout promise
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      if (!isConnected) {
        logger.error('Database connection timed out', {
          timeoutMs
        });
        resolve(false);
      }
    }, timeoutMs);
  });

  // Race the connection against the timeout
  return Promise.race([connectionPromise, timeoutPromise]);
};

// Create and initialize the prisma client
export const prisma = 
  globalForPrisma.prisma ?? 
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Initialize connection for non-production environments
if (process.env.NODE_ENV !== 'production') {
  // Only store prisma client in global if we're not in production
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma;
    
    // Test the connection when the module is loaded
    connectWithTimeout(prisma)
      .then((connected) => {
        if (!connected) {
          logger.warn('Database connection issues detected', {
            message: 'Auth might not work properly'
          });
        }
      });
  }
}