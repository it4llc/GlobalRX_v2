// /GlobalRX_v2/src/lib/services/order-core.service.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';
import { SubjectInfo } from '@/components/portal/orders/types';
import { ActivityTrackingService } from './activity-tracking.service';

// Type definitions for field values to avoid using 'any'
type FieldValue = string | number | boolean | Date | null;
type FieldValueRecord = Record<string, FieldValue | Record<string, FieldValue>>;
import { OrderNumberService } from './order-number.service';
import { AddressService } from './address.service';
import { FieldResolverService } from './field-resolver.service';
import { OrderValidationService } from './order-validation.service';
import { ServiceFulfillmentService } from './service-fulfillment.service';

/**
 * Core order service handling CRUD operations and state management
 * Orchestrates other specialized services for complete order functionality
 */
export class OrderCoreService {
  /**
   * Valid order status transitions
   * Business rules:
   * - Any state can transition to cancelled
   * - more_info_needed → processing goes through submitted first
   * - No backward transitions (except to cancelled)
   */
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    'draft': ['submitted', 'cancelled'],
    'submitted': ['processing', 'more_info_needed', 'cancelled'],
    'processing': ['completed', 'more_info_needed', 'cancelled'],
    'more_info_needed': ['submitted', 'processing', 'cancelled'],
    'completed': ['cancelled'],
    'cancelled': [], // Terminal state
  };

  /**
   * Field mapping for consistent naming across different data sources
   * Extensible: Add new mappings as needed
   */
  private static readonly FIELD_MAPPING: Record<string, string> = {
    // Name fields
    'First Name': 'firstName',
    'first_name': 'firstName',
    'Last Name': 'lastName',
    'Surname/Last Name': 'lastName',
    'surname': 'lastName',
    'last_name': 'lastName',
    'Middle Name': 'middleName',
    'middle_name': 'middleName',

    // Contact fields
    'Email Address': 'email',
    'Phone Number': 'phone',
    'phoneNumber': 'phone',

    // Address fields
    'Street Address': 'address',
    'Residence Address': 'address',
    'residenceAddress': 'address',

    // Personal info
    'Date of Birth': 'dateOfBirth',
    'DOB': 'dateOfBirth',
    'dob': 'dateOfBirth',

    // Add more mappings here as needed
  };

  /**
   * Normalize and merge subject data, ensuring consistent field naming and resolved values
   */
  static async normalizeSubjectData(
    baseSubject: SubjectInfo,
    subjectFieldValues?: FieldValueRecord,
    userId?: string
  ): Promise<FieldValueRecord> {
    // First, resolve any IDs in subjectFieldValues to actual values
    const resolvedFieldValues = subjectFieldValues
      ? await FieldResolverService.resolveFieldValues(subjectFieldValues as Record<string, any>)
      : {};

    // Start with base subject data
    // Start with base subject data, converting to our field value type
    const normalized: FieldValueRecord = {};
    Object.entries(baseSubject).forEach(([key, value]) => {
      normalized[key] = value;
    });

    // Process resolved field values and normalize field names
    for (const [originalKey, value] of Object.entries(resolvedFieldValues)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      // Get the normalized field name
      const normalizedKey = this.FIELD_MAPPING[originalKey] || originalKey;

      // Only store if we don't already have this field or if the new value is more complete
      if (!normalized[normalizedKey] || (typeof value === 'string' && value.trim().length > 0)) {
        normalized[normalizedKey] = typeof value === 'string' ? value.trim() : value;
      }
    }

    // Remove any empty or null values
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === null || normalized[key] === undefined || normalized[key] === '') {
        delete normalized[key];
      }
    });

    return normalized;
  }

  /**
   * Create a new order
   */
  static async createOrder(data: {
    customerId: string;
    userId: string;
    subject: SubjectInfo;
    notes?: string;
  }) {
    const orderNumber = await OrderNumberService.generateOrderNumber(data.customerId);

    // Normalize the subject data to ensure consistency
    const normalizedSubject = await this.normalizeSubjectData(data.subject, undefined, data.userId);

    // Auto-assign to primary vendor if one exists
    const primaryVendor = await prisma.vendorOrganization.findFirst({
      where: { isPrimary: true, isActive: true }
    });

    if (primaryVendor) {
      logger.info('Auto-assigning order to primary vendor', {
        orderNumber,
        vendorId: primaryVendor.id,
        vendorName: primaryVendor.name
      });
    }

    return prisma.order.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        userId: data.userId,
        statusCode: 'draft',
        subject: normalizedSubject,
        notes: data.notes,
        assignedVendorId: primaryVendor?.id || null,
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
        assignedVendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Instance method for creating a complete order - used by tests
   *
   * BUSINESS REQUIREMENT: Every OrderItem must have exactly one ServicesFulfillment record
   * created in the same database transaction. This 1:1 relationship is enforced at the
   * database level and prevents the cascading ID mismatch bugs that occur when
   * ServicesFulfillment records are created separately or delayed.
   */
  async createCompleteOrder(
    data: {
      customerId: string;
      subjectData?: Record<string, unknown>;
      services?: Array<{
        serviceId: string;
        locationId: string;
      }>;
      notes?: string;
    },
    userId: string
  ) {
    // Use transaction to ensure atomicity
    return prisma.$transaction(async (tx) => {
      // Create the main order
      const order = await tx.order.create({
        data: {
          orderNumber: `TEST-ORDER-${Date.now()}`, // Simple test order number
          customerId: data.customerId,
          userId,
          statusCode: 'draft',
          subject: data.subjectData || {},
          notes: data.notes,
        },
      });

      // Create order items and ServicesFulfillment records for each service
      if (data.services) {
        for (const service of data.services) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              serviceId: service.serviceId,
              locationId: service.locationId,
              status: order.statusCode, // BUG FIX: Order items must inherit parent order status
                                              // PROBLEM: Previously hardcoded 'pending' status which was removed from
                                              // SERVICE_STATUSES constant in commit 3706b39, creating invalid data
                                              // SOLUTION: Order items now inherit their parent order's status (draft/submitted)
            },
          });

          // Auto-create ServicesFulfillment record immediately to ensure data integrity.
          // This must happen in the same transaction to prevent orphaned OrderItems
          // that would cause cascading ID mismatch bugs in the fulfillment module.
          await tx.servicesFulfillment.create({
            data: {
              orderId: order.id,
              orderItemId: orderItem.id,
              serviceId: service.serviceId,
              locationId: service.locationId,
              // assignedVendorId is explicitly null, not inherited from order.assignedVendorId.
              // Business rule: Each service can have its own vendor assignment independent
              // of the order-level vendor, allowing granular fulfillment control.
              assignedVendorId: null,
            },
          });

          // Log the creation without PII
          logger.info('ServiceFulfillment auto-created for OrderItem', {
            orderId: order.id,
            orderItemId: orderItem.id,
            serviceId: service.serviceId,
            locationId: service.locationId,
          });
        }
      }

      // Create subject data if provided
      if (data.subjectData) {
        await tx.subjectData.create({
          data: {
            orderId: order.id,
            ...data.subjectData,
          },
        });
      }

      // Create initial status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'draft',
          changedBy: userId,
          reason: 'Order created',
        },
      });

      return order;
    });
  }

  /**
   * Instance method for adding an order item - wraps the static method
   * Used by tests that expect instance methods
   *
   * BUSINESS REQUIREMENT: Every new OrderItem must have exactly one ServicesFulfillment record
   * created in the same database transaction. This prevents orphaned OrderItems that would
   * cause ID mismatch bugs and display issues in the fulfillment module.
   */
  async addOrderItem(
    orderId: string,
    serviceId: string,
    locationId: string,
    userId: string,
    userType?: 'customer' | 'internal' | 'vendor'
  ) {
    // Use transaction to ensure atomicity between OrderItem and ServiceFulfillment
    return prisma.$transaction(async (tx) => {
      // Verify order exists and is editable (don't require customerId for test compatibility)
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Support both 'status' and 'statusCode' fields for compatibility
      const currentStatus = 'status' in order && typeof order.status === 'string'
        ? order.status
        : order.statusCode;
      if (currentStatus !== 'draft') {
        throw new Error('Order not found or cannot be edited');
      }

      // Check for existing items to prevent duplicates
      const existingItems = await tx.orderItem.findMany({
        where: {
          orderId,
          serviceId,
          locationId,
        },
      });

      if (existingItems.length > 0) {
        throw new Error('Unique constraint failed on orderItemId');
      }

      // Create the OrderItem
      const orderItem = await tx.orderItem.create({
        data: {
          orderId,
          serviceId,
          locationId,
          status: currentStatus, // BUG FIX: Order items must inherit parent order status
                                   // PROBLEM: Previously hardcoded 'pending' status which was removed from
                                   // SERVICE_STATUSES constant in commit 3706b39, creating invalid data
                                   // SOLUTION: Order items now inherit their parent order's status (draft/submitted)
        },
      });

      // Auto-create ServicesFulfillment record immediately to ensure data integrity.
      // This must happen in the same transaction to prevent orphaned OrderItems
      // that would cause cascading ID mismatch bugs in the fulfillment module.
      await tx.servicesFulfillment.create({
        data: {
          orderId,
          orderItemId: orderItem.id,
          serviceId,
          locationId,
          // assignedVendorId is explicitly null, not inherited from order.assignedVendorId.
          // Business rule: Each service can have its own vendor assignment independent
          // of the order-level vendor, allowing granular fulfillment control.
          assignedVendorId: null,
        },
      });

      logger.info('ServiceFulfillment auto-created for added OrderItem', {
        orderId,
        orderItemId: orderItem.id,
        serviceId,
        locationId,
      });

      // Phase 2B-2: Update activity tracking if user type is provided
      // New order item added is a customer-visible event
      if (userType) {
        await ActivityTrackingService.updateOrderActivity(
          tx,
          orderId,
          userId,
          userType,
          true // isCustomerVisible - adding order items is customer-visible
        );
      }

      return orderItem;
    });
  }

  /**
   * Create a complete order with service items and field data
   *
   * BUSINESS REQUIREMENT: Every OrderItem must have exactly one ServicesFulfillment record
   * created in the same database transaction. This 1:1 relationship is enforced at the
   * database level and prevents the cascading ID mismatch bugs that occur when
   * ServicesFulfillment records are created separately or delayed.
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
    subject: SubjectInfo;
    subjectFieldValues?: FieldValueRecord;
    searchFieldValues?: Record<string, FieldValueRecord>;
    uploadedDocuments?: Record<string, FieldValue | FieldValue[]>;
    notes?: string;
    status?: 'draft' | 'submitted';
  }) {
    const orderNumber = await OrderNumberService.generateOrderNumber(data.customerId);

    // Auto-assign to primary vendor if one exists
    const primaryVendor = await prisma.vendorOrganization.findFirst({
      where: { isPrimary: true, isActive: true }
    });

    if (primaryVendor) {
      logger.info('Auto-assigning order to primary vendor', {
        orderNumber,
        vendorId: primaryVendor.id,
        vendorName: primaryVendor.name
      });
    }

    // Normalize and resolve the subject data properly
    const normalizedSubject = await this.normalizeSubjectData(
      data.subject,
      data.subjectFieldValues,
      data.userId
    );

    // Validate requirements if attempting to submit
    let finalStatus = data.status;
    let validationResult = null;

    if (data.status === 'submitted' || !data.status) {
      // Validate all requirements are met
      validationResult = await OrderValidationService.validateOrderRequirements({
        serviceItems: data.serviceItems,
        subjectFieldValues: data.subjectFieldValues,
        searchFieldValues: data.searchFieldValues,
        uploadedDocuments: data.uploadedDocuments,
      });

      // If validation fails and trying to submit, force to draft
      if (!validationResult.isValid) {
        finalStatus = 'draft';
        logger.warn('Order validation failed, saving as draft', {
          customerId: data.customerId,
          serviceItemsCount: data.serviceItems.length,
          missingRequirements: validationResult.missingRequirements
        });
      } else {
        finalStatus = 'submitted';
      }
    }

    // Create the main order with transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
      // Create the main order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          userId: data.userId,
          statusCode: finalStatus || 'draft', // Default to draft if no status
          subject: normalizedSubject,
          notes: data.notes,
          assignedVendorId: primaryVendor?.id || null,
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

      // Store the first order item ID for subject fields
      let firstOrderItemId: string | null = null;

      // Create order items for each service+location combination
      for (const serviceItem of data.serviceItems) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            serviceId: serviceItem.serviceId,
            locationId: serviceItem.locationId,
            status: order.statusCode, // BUG FIX: Order items must inherit parent order status
                                            // PROBLEM: Previously hardcoded 'pending' status which was removed from
                                            // SERVICE_STATUSES constant in commit 3706b39, creating invalid data
                                            // SOLUTION: Order items now inherit their parent order's status (draft/submitted)
          },
        });

        // Store the first order item ID for subject fields
        if (!firstOrderItemId) {
          firstOrderItemId = orderItem.id;
        }

        // Auto-create ServicesFulfillment record immediately to ensure data integrity.
        // This must happen in the same transaction to prevent orphaned OrderItems
        // that would cause cascading ID mismatch bugs in the fulfillment module.
        await tx.servicesFulfillment.create({
          data: {
            orderId: order.id,
            orderItemId: orderItem.id,
            serviceId: serviceItem.serviceId,
            locationId: serviceItem.locationId,
            // assignedVendorId is explicitly null, not inherited from order.assignedVendorId.
            // Business rule: Each service can have its own vendor assignment independent
            // of the order-level vendor, allowing granular fulfillment control.
            assignedVendorId: null,
          },
        });

        logger.info('ServiceFulfillment auto-created for OrderItem', {
          orderId: order.id,
          orderItemId: orderItem.id,
          serviceId: serviceItem.serviceId,
          locationId: serviceItem.locationId,
        });

        // Create order data entries for search fields specific to this service item
        const searchFields = data.searchFieldValues?.[serviceItem.itemId];
        if (searchFields) {
          // Resolve IDs in search fields to human-readable values
          const resolvedSearchFields = await FieldResolverService.resolveFieldValues(searchFields);

          for (const [fieldName, fieldValue] of Object.entries(resolvedSearchFields)) {
            // Save all field values except undefined (which means the field doesn't exist)
            // This ensures optional empty fields are saved and can be restored when editing
            // Bug fix: Previously filtered out null and empty values, causing optional address blocks to not restore
            if (fieldValue !== undefined) {
              // Store the resolved value, not the raw ID
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

      // Save subject field values to order_data table to preserve structured data (like address blocks)
      // This ensures address blocks aren't flattened and can be properly restored when editing
      // Subject fields apply to the entire order, so we associate them with the first order item
      if (data.subjectFieldValues && firstOrderItemId) {
        // Do NOT resolve subject field values - we need to keep the field UUIDs as keys
        // so they can be directly mapped back when loading
        for (const [fieldId, fieldValue] of Object.entries(data.subjectFieldValues)) {
          // Save all field values except undefined
          if (fieldValue !== undefined) {
            await tx.orderData.create({
              data: {
                orderItemId: firstOrderItemId,
                fieldName: fieldId, // Store the field UUID directly
                fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
                fieldType: 'subject', // Mark as subject field for proper restoration
              },
            });
          }
        }
      }

      // Return order with validation result attached
      return {
        ...order,
        validationResult: validationResult
      };
    });
  }

  /**
   * Update order status with state machine validation
   * Tracks status change reasons in history
   *
   * @param orderId The order ID
   * @param customerId The customer ID (pass null to bypass customer check for fulfillment users)
   * @param userId The user making the change
   * @param newStatus The new status
   * @param reason The reason for the change
   * @param bypassValidation If true, bypasses transition validation (for fulfillment users)
   */
  static async updateOrderStatus(
    orderId: string,
    customerId: string | null,
    userId: string,
    newStatus: string,
    reason: string,
    bypassValidation: boolean = false
  ) {
    // Fetch the order to verify it exists and customer has access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // If customerId is provided, verify it matches
    if (customerId && order.customerId !== customerId) {
      throw new Error('Order not found');
    }

    // Check if transition is valid (unless bypassing for fulfillment users)
    if (!bypassValidation) {
      const allowedTransitions = this.VALID_TRANSITIONS[order.statusCode] || [];
      if (!allowedTransitions.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${order.statusCode} to ${newStatus}`);
      }
    }

    // Special case: if transitioning from more_info_needed to processing
    if (order.statusCode === 'more_info_needed' && newStatus === 'processing') {
      // Do both transitions in sequence without recursive calls
      return prisma.$transaction([
        // First transition: more_info_needed -> submitted
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
            fromStatus: order.statusCode,
            toStatus: 'submitted',
            changedBy: userId,
            reason,
          },
        }),
        // Second transition: submitted -> processing
        prisma.order.update({
          where: { id: orderId },
          data: {
            statusCode: 'processing',
          },
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: 'submitted',
            toStatus: 'processing',
            changedBy: userId,
            reason: 'Auto-transition to processing',
          },
        }),
      ]);
    }

    const result = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          statusCode: newStatus,
          submittedAt: newStatus === 'submitted' ? new Date() : undefined,
          completedAt: newStatus === 'completed' ? new Date() : undefined,
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.statusCode,
          toStatus: newStatus,
          changedBy: userId,
          reason,
        },
      }),
    ]);

    // Create ServicesFulfillment records when order is submitted
    // This is the critical transition point where order-level processing becomes service-level fulfillment.
    // Each OrderItem gets its own ServicesFulfillment record for independent tracking and vendor assignment.
    // Status is managed on OrderItem, not ServicesFulfillment, to maintain a single source of truth.
    // This transformation enables granular fulfillment control where different services can have different vendors and timelines.
    if (newStatus === 'submitted' && order.statusCode === 'draft') {
      try {
        // Get all order items for this order
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId },
          select: { id: true }
        });

        if (orderItems.length > 0) {
          await ServiceFulfillmentService.createServicesForOrder(orderId, userId);

          logger.info('ServicesFulfillment records created for submitted order', {
            orderId,
            itemCount: orderItems.length,
            userId
          });
        }
      } catch (error) {
        // Log error but don't fail the order submission
        logger.error('Failed to create ServicesFulfillment records', {
          error: error instanceof Error ? error.message : 'Unknown error',
          orderId,
          userId
        });
      }
    }

    return result;
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
            // CRITICAL: Always order by service name then creation time to prevent
            // services from changing display order when their status is updated.
            // Without explicit ordering, Prisma returns results in undefined order
            // which caused UI instability when services moved around after status updates.
            orderBy: [
              { service: { name: 'asc' } },
              { createdAt: 'asc' }
            ],
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
   * Alias for getCustomerOrders to match test expectations
   */
  static async getOrdersForCustomer(customerId: string, filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.getCustomerOrders(customerId, filters);
  }

  /**
   * Get a single order by ID
   */
  static async getOrderById(orderId: string, customerId: string) {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
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
          },
          // CRITICAL: Always order by service name then creation time to prevent
          // services from changing display order when their status is updated.
          //
          // BUG FIX (March 14, 2026): Services were appearing to "jump around" in order
          // lists after status updates because Prisma returns results in undefined order
          // when no explicit orderBy is specified. This caused significant UI instability
          // where the same services would appear in different positions after any database
          // operation, creating a poor user experience.
          //
          // BUSINESS IMPACT: Users reported confusion when services changed positions
          // after status updates, making it difficult to track progress on multi-service orders.
          //
          // ROOT CAUSE: Missing orderBy clauses in all order item queries meant that
          // PostgreSQL returned results in whatever order was most efficient for the query,
          // which could vary based on database state, indexing, and query execution plan.
          //
          // SOLUTION: Explicit alphabetical ordering by service name (primary) and creation
          // time (secondary) ensures consistent display order regardless of status changes.
          orderBy: [
            { service: { name: 'asc' } },
            { createdAt: 'asc' }
          ],
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

    // Verify customer has access to this order
    if (order && order.customerId !== customerId) {
      return null;
    }

    return order;
  }

  /**
   * Update an order (only if in draft status)
   */
  static async updateOrder(
    orderId: string,
    customerId: string,
    data: Partial<{
      subject: SubjectInfo;
      notes: string;
    }>
  ) {
    // First check if order exists and is in draft status
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order || order.customerId !== customerId || order.statusCode !== 'draft') {
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
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order || order.customerId !== customerId || order.statusCode !== 'draft') {
      throw new Error('Order not found or already submitted');
    }

    // Validate before submission
    const { canSubmit, validationResult } = await OrderValidationService.canSubmitOrder(orderId);

    if (!canSubmit) {
      logger.warn('Order cannot be submitted due to missing requirements', {
        orderId,
        missingRequirements: validationResult.missingRequirements
      });
      throw new Error('Order validation failed. Missing required fields or documents.');
    }

    return this.updateOrderStatus(orderId, customerId, userId, 'submitted', 'Order submitted by customer');
  }

  /**
   * Delete a draft order
   */
  static async deleteOrder(orderId: string, customerId: string) {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!order || order.customerId !== customerId || order.statusCode !== 'draft') {
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
    const [total, draft, submitted, more_info_needed, processing, completed, cancelled] = await Promise.all([
      prisma.order.count({ where: { customerId } }),
      prisma.order.count({ where: { customerId, statusCode: 'draft' } }),
      prisma.order.count({ where: { customerId, statusCode: 'submitted' } }),
      prisma.order.count({ where: { customerId, statusCode: 'more_info_needed' } }),
      prisma.order.count({ where: { customerId, statusCode: 'processing' } }),
      prisma.order.count({ where: { customerId, statusCode: 'completed' } }),
      prisma.order.count({ where: { customerId, statusCode: 'cancelled' } }),
    ]);

    return {
      total,
      draft,
      submitted,
      more_info_needed,
      processing,
      completed,
      cancelled,
      pending: submitted + processing + more_info_needed, // Combined for dashboard
    };
  }

  /**
   * Add an item to an order
   *
   * BUSINESS REQUIREMENT: Every new OrderItem must have exactly one ServicesFulfillment record
   * created in the same database transaction. This prevents orphaned OrderItems that would
   * cause ID mismatch bugs and display issues in the fulfillment module.
   */
  static async addOrderItem(
    orderId: string,
    customerId: string,
    item: {
      serviceId: string;
      locationId: string;
      price?: number;
    },
    userId?: string, // Added optional userId parameter to match test expectations
    userType?: 'customer' | 'internal' | 'vendor'
  ) {
    // Use transaction to ensure atomicity between OrderItem and ServiceFulfillment
    return prisma.$transaction(async (tx) => {
      // Verify order exists and is editable
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          customerId,
          statusCode: 'draft',
        },
      });

      if (!order) {
        throw new Error('Order not found or cannot be edited');
      }

      // Create the OrderItem
      const orderItem = await tx.orderItem.create({
        data: {
          orderId,
          serviceId: item.serviceId,
          locationId: item.locationId,
          status: order.statusCode, // BUG FIX: Order items must inherit parent order status
                                          // PROBLEM: Previously hardcoded 'pending' status which was removed from
                                          // SERVICE_STATUSES constant in commit 3706b39, creating invalid data
                                          // SOLUTION: Order items now inherit their parent order's status (draft/submitted)
          price: item.price,
        },
        include: {
          service: true,
          location: true,
        },
      });

      // Auto-create ServicesFulfillment record immediately to ensure data integrity.
      // This must happen in the same transaction to prevent orphaned OrderItems
      // that would cause cascading ID mismatch bugs in the fulfillment module.
      await tx.servicesFulfillment.create({
        data: {
          orderId,
          orderItemId: orderItem.id,
          serviceId: item.serviceId,
          locationId: item.locationId,
          // assignedVendorId is explicitly null, not inherited from order.assignedVendorId.
          // Business rule: Each service can have its own vendor assignment independent
          // of the order-level vendor, allowing granular fulfillment control.
          assignedVendorId: null,
        },
      });

      logger.info('ServiceFulfillment auto-created for added OrderItem', {
        orderId,
        orderItemId: orderItem.id,
        serviceId: item.serviceId,
        locationId: item.locationId,
      });

      // Phase 2B-2: Update activity tracking if user ID and type are provided
      // New order item added is a customer-visible event
      if (userId && userType) {
        await ActivityTrackingService.updateOrderActivity(
          tx,
          orderId,
          userId,
          userType,
          true // isCustomerVisible - adding order items is customer-visible
        );
      }

      return orderItem;
    });
  }

  /**
   * Update order status for fulfillment users (no customer constraint, no validation)
   * This method bypasses the normal state machine validation to allow unrestricted status changes
   *
   * @param orderId The order ID
   * @param userId The fulfillment user making the change
   * @param newStatus The new status
   * @param notes Optional notes about the status change
   */
  static async updateOrderStatusForFulfillment(
    orderId: string,
    userId: string,
    newStatus: string,
    notes?: string
  ) {
    // Use the main method with bypass flags
    return this.updateOrderStatus(
      orderId,
      null, // No customer constraint
      userId,
      newStatus,
      notes || 'Status updated by fulfillment',
      true // Bypass validation
    );
  }

  /**
   * Get full order details without customer ID constraint
   * Used by internal users (fulfillment, admin) who need to access any order
   *
   * @param orderId The order ID to fetch
   * @returns The full order details with customer info, or null if not found
   */
  static async getFullOrderDetails(orderId: string) {
    return prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            disabled: true,
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
        assignedVendor: {
          select: {
            id: true,
            name: true,
          },
        },
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
            data: true,
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
}