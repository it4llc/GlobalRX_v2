// src/lib/services/order.service.ts
/**
 * FACADE PATTERN for backward compatibility
 *
 * This file maintains the original OrderService interface
 * while delegating to the new refactored services.
 *
 * Migration plan:
 * 1. Current state: All APIs use this facade ✓
 * 2. Future: Gradually update APIs to use specific services directly
 * 3. Final: Remove this facade once all APIs are migrated
 *
 * New service structure:
 * - OrderNumberService: Order number generation
 * - AddressService: Address entry management
 * - FieldResolverService: UUID to readable value resolution
 * - OrderValidationService: Order requirement validation
 * - OrderCoreService: Main order CRUD and state management
 */

import { OrderCoreService } from './order-core.service';
import { OrderNumberService } from './order-number.service';
import { AddressService } from './address.service';
import { FieldResolverService } from './field-resolver.service';
import { OrderValidationService } from './order-validation.service';

/**
 * @deprecated Use the specific services directly for new code
 * This facade exists only for backward compatibility
 */
export class OrderService {
  /**
   * @deprecated Use OrderNumberService.generateOrderNumber() directly
   */
  static async generateOrderNumber(customerId: string, maxRetries = 5): Promise<string> {
    return OrderNumberService.generateOrderNumber(customerId, maxRetries);
  }

  /**
   * @deprecated Use OrderCoreService.createOrder() directly
   */
  static async createOrder(data: {
    customerId: string;
    userId: string;
    subject: any;
    notes?: string;
  }) {
    return OrderCoreService.createOrder(data);
  }

  /**
   * @deprecated Use OrderCoreService.createCompleteOrder() directly
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
    return OrderCoreService.createCompleteOrder(data);
  }

  /**
   * @deprecated Use OrderValidationService.validateOrderRequirements() directly
   */
  static async validateOrderRequirements(data: {
    serviceItems: Array<{
      serviceId: string;
      locationId: string;
      itemId: string;
    }>;
    subjectFieldValues?: Record<string, any>;
    searchFieldValues?: Record<string, Record<string, any>>;
    uploadedDocuments?: Record<string, any>;
  }) {
    return OrderValidationService.validateOrderRequirements(data);
  }

  /**
   * @deprecated Use OrderCoreService.getCustomerOrders() directly
   */
  static async getCustomerOrders(customerId: string, filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    return OrderCoreService.getCustomerOrders(customerId, filters);
  }

  /**
   * @deprecated Use OrderCoreService.getOrderById() directly
   */
  static async getOrderById(orderId: string, customerId: string) {
    return OrderCoreService.getOrderById(orderId, customerId);
  }

  /**
   * @deprecated Use OrderCoreService.updateOrder() directly
   */
  static async updateOrder(
    orderId: string,
    customerId: string,
    data: Partial<{
      subject: any;
      notes: string;
    }>
  ) {
    return OrderCoreService.updateOrder(orderId, customerId, data);
  }

  /**
   * @deprecated Use OrderCoreService.submitOrder() directly
   */
  static async submitOrder(orderId: string, customerId: string, userId: string) {
    return OrderCoreService.submitOrder(orderId, customerId, userId);
  }

  /**
   * @deprecated Use OrderCoreService.deleteOrder() directly
   */
  static async deleteOrder(orderId: string, customerId: string) {
    return OrderCoreService.deleteOrder(orderId, customerId);
  }

  /**
   * @deprecated Use OrderCoreService.getCustomerOrderStats() directly
   */
  static async getCustomerOrderStats(customerId: string) {
    return OrderCoreService.getCustomerOrderStats(customerId);
  }

  /**
   * @deprecated Use OrderCoreService.addOrderItem() directly
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
    return OrderCoreService.addOrderItem(orderId, customerId, item);
  }

  // Private methods that tests might be accessing - delegate to appropriate services
  /**
   * @deprecated Use AddressService.createOrFindAddressEntry() directly
   * @private
   */
  private static async createOrFindAddressEntry(addressData: any, userId: string): Promise<string | null> {
    return AddressService.createOrFindAddressEntry(addressData, userId);
  }

  /**
   * @deprecated Use FieldResolverService.resolveFieldValues() directly
   * @private
   */
  private static async resolveFieldValues(fieldValues: Record<string, any>): Promise<Record<string, any>> {
    return FieldResolverService.resolveFieldValues(fieldValues);
  }

  /**
   * @deprecated Use OrderCoreService.normalizeSubjectData() directly
   * @private
   */
  private static async normalizeSubjectData(
    baseSubject: any,
    subjectFieldValues?: Record<string, any>,
    userId?: string
  ): Promise<Record<string, any>> {
    return OrderCoreService.normalizeSubjectData(baseSubject, subjectFieldValues, userId);
  }
}