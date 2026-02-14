// src/lib/services/order.service.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export class OrderService {
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
  static async generateOrderNumber(customerId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Get start and end of current day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get the count of orders for this customer today
    const count = await prisma.order.count({
      where: {
        customerId: customerId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Generate consistent customer code based on customer ID
    const customerCode = this.generateCustomerCode(customerId);

    // Create sequence number (starts at 1, padded to 4 digits)
    const sequence = String(count + 1).padStart(4, '0');

    return `${dateStr}-${customerCode}-${sequence}`;
  }

  /**
   * Create a new order
   */
  static async createOrder(data: {
    customerId: string;
    userId: string;
    subject: any;
    notes?: string;
  }) {
    const orderNumber = await this.generateOrderNumber(data.customerId);

    return prisma.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        userId: data.userId,
        statusCode: 'draft',
        subject: data.subject,
        notes: data.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Create a complete order with service items and field data
   */
  static async createCompleteOrder(data: {
    customerId: string;
    userId: string;
    serviceItems: Array<{
      serviceId: string;
      serviceName: string;
      locationId: string;
      locationName: string;
      itemId: string;
    }>;
    subject: any;
    subjectFieldValues?: Record<string, any>;
    searchFieldValues?: Record<string, Record<string, any>>;
    uploadedDocuments?: Record<string, any>;
    notes?: string;
    status?: 'draft' | 'submitted';
  }) {
    const orderNumber = await this.generateOrderNumber(data.customerId);

    // Prepare the merged subject object
    const mergedSubject = {
      ...data.subject,
      ...data.subjectFieldValues,
      // Ensure we have firstName/lastName for display compatibility
      firstName: data.subject?.firstName ||
                data.subjectFieldValues?.['First Name'] ||
                data.subjectFieldValues?.firstName,
      lastName: data.subject?.lastName ||
               data.subjectFieldValues?.['Last Name'] ||
               data.subjectFieldValues?.['Surname/Last Name'] ||
               data.subjectFieldValues?.lastName,
    };

    // Create the main order with transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Create the main order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          userId: data.userId,
          statusCode: data.status || 'submitted', // Default to submitted for complete orders
          subject: mergedSubject,
          notes: data.notes,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Create order items for each service+location combination
      for (const serviceItem of data.serviceItems) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            serviceId: serviceItem.serviceId,
            locationId: serviceItem.locationId,
            status: 'pending',
          },
        });

        // Create order data entries for search fields specific to this service item
        const searchFields = data.searchFieldValues?.[serviceItem.itemId];
        if (searchFields) {
          for (const [fieldName, fieldValue] of Object.entries(searchFields)) {
            if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
              await tx.orderData.create({
                data: {
                  orderItemId: orderItem.id,
                  fieldName,
                  fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
                  fieldType: 'search', // TODO: Get actual field type from requirements
                },
              });
            }
          }
        }

        // TODO: Handle document uploads for this order item
        // const documents = data.uploadedDocuments?.[serviceItem.itemId];
        // if (documents) { ... }
      }

      return order;
    });
  }

  /**
   * Get orders for a customer
   */
  static async getCustomerOrders(customerId: string, filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.OrderWhereInput = {
      customerId,
    };

    if (filters?.status) {
      where.statusCode = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                  code2: true,
                },
              },
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Get a single order by ID
   */
  static async getOrderById(orderId: string, customerId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
      },
      include: {
        customer: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            service: true,
            location: true,
            data: true,
            documents: true,
          },
        },
        statusHistory: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Update an order (only if in draft status)
   */
  static async updateOrder(
    orderId: string,
    customerId: string,
    data: Partial<{
      subject: any;
      notes: string;
    }>
  ) {
    // First check if order exists and is in draft status
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or cannot be edited');
    }

    return prisma.order.update({
      where: { id: orderId },
      data,
    });
  }

  /**
   * Submit an order (change status from draft to submitted)
   */
  static async submitOrder(orderId: string, customerId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or already submitted');
    }

    // Use a transaction to update order and create status history
    return prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          statusCode: 'submitted',
          submittedAt: new Date(),
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedBy: userId,
          reason: 'Order submitted by customer',
        },
      }),
    ]);
  }

  /**
   * Delete a draft order
   */
  static async deleteOrder(orderId: string, customerId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or cannot be deleted');
    }

    // Delete will cascade to items, data, documents, and history
    return prisma.order.delete({
      where: { id: orderId },
    });
  }

  /**
   * Get order statistics for a customer
   */
  static async getCustomerOrderStats(customerId: string) {
    const [total, draft, submitted, processing, completed, cancelled] = await Promise.all([
      prisma.order.count({ where: { customerId } }),
      prisma.order.count({ where: { customerId, statusCode: 'draft' } }),
      prisma.order.count({ where: { customerId, statusCode: 'submitted' } }),
      prisma.order.count({ where: { customerId, statusCode: 'processing' } }),
      prisma.order.count({ where: { customerId, statusCode: 'completed' } }),
      prisma.order.count({ where: { customerId, statusCode: 'cancelled' } }),
    ]);

    return {
      total,
      draft,
      submitted,
      processing,
      completed,
      cancelled,
      pending: submitted + processing, // Combined for dashboard
    };
  }

  /**
   * Add an item to an order
   */
  static async addOrderItem(
    orderId: string,
    customerId: string,
    item: {
      serviceId: string;
      locationId: string;
      price?: number;
    }
  ) {
    // Verify order exists and is editable
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        statusCode: 'draft',
      },
    });

    if (!order) {
      throw new Error('Order not found or cannot be edited');
    }

    return prisma.orderItem.create({
      data: {
        orderId,
        serviceId: item.serviceId,
        locationId: item.locationId,
        status: 'pending',
        price: item.price,
      },
      include: {
        service: true,
        location: true,
      },
    });
  }
}