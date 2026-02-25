// src/lib/services/order-number.service.ts
import { prisma } from '@/lib/prisma';

/**
 * Service for generating unique order numbers
 * Format: YYYYMMDD-ABC-0001 where:
 * - YYYYMMDD: Current date
 * - ABC: 3-character customer code (consistent per customer)
 * - 0001: Sequential number per customer per day
 */
export class OrderNumberService {
  /**
   * Generate a consistent 3-character customer code based on customer ID
   * This ensures the same customer always gets the same code
   */
  private static generateCustomerCode(customerId: string): string {
    // Use the first 8 chars of the customer UUID to generate a consistent hash
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const hash = customerId.replace(/-/g, '').substring(0, 8);

    let code = '';
    for (let i = 0; i < 3; i++) {
      // Convert hex to index in our character set
      const hexPair = hash.substring(i * 2, i * 2 + 2);
      const index = parseInt(hexPair, 16) % chars.length;
      code += chars.charAt(index);
    }
    return code;
  }

  /**
   * Generate a unique order number in format: YYYYMMDD-ABC-0001
   * Where ABC is a consistent 3-char code per customer and 0001 increments per customer per day
   */
  static async generateOrderNumber(customerId: string, maxRetries = 5): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Generate consistent customer code based on customer ID
    const customerCode = this.generateCustomerCode(customerId);

    // Get start and end of current day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Get the highest sequence number for this customer today
      const lastOrder = await prisma.order.findFirst({
        where: {
          customerId: customerId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          orderNumber: true
        }
      });

      let nextSequence = 1;
      if (lastOrder && lastOrder.orderNumber) {
        // Extract sequence number from the order number
        const parts = lastOrder.orderNumber.split('-');
        if (parts.length >= 3) {
          const lastSequence = parseInt(parts[2], 10);
          if (!isNaN(lastSequence)) {
            nextSequence = lastSequence + 1;
          }
        }
      }

      // Create sequence number (padded to 4 digits)
      const sequence = String(nextSequence).padStart(4, '0');
      const orderNumber = `${dateStr}-${customerCode}-${sequence}`;

      // Check if this order number already exists (race condition protection)
      const existing = await prisma.order.findUnique({
        where: { orderNumber }
      });

      if (!existing) {
        return orderNumber;
      }

      // If we reach here, there was a collision, try again with a small delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }

    // Fallback: add timestamp if all retries failed
    const timestamp = Date.now().toString().slice(-6);
    const sequence = String(1).padStart(4, '0');
    return `${dateStr}-${customerCode}-${sequence}-${timestamp}`;
  }
}