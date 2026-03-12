// /GlobalRX_v2/src/lib/services/service-order-data.service.ts

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import type { OrderData } from '@/lib/schemas/service-order-data.schemas';
import type {
  OrderSubject,
  WorkflowSection,
  WorkflowField
} from '@/types/service-order-data';

/**
 * Service for fetching and formatting order data for service fulfillment
 * Business Rule: All fields from OrderData table must be included except Subject Information duplicates
 */
export class ServiceOrderDataService {
  /**
   * Subject field names that should be excluded from order data
   *
   * Business Rule 3: Subject Information fields that duplicate order.subject must NOT be included
   *
   * WHY WE EXCLUDE THESE FIELDS:
   * - The order.subject JSON already contains personal information (name, DOB, email, SSN, phone)
   * - Including these fields in orderData would create redundant data display in the UI
   * - Customers see the same information twice, which creates confusion
   * - Keeps the orderData focused on service-specific requirements, not personal details
   *
   * NOTE: We check both camelCase and display names because different workflows may
   * store field names differently (raw vs. user-friendly labels)
   */
  private static readonly SUBJECT_FIELDS = new Set([
    'firstName',
    'First Name',
    'lastName',
    'Last Name',
    'middleName',
    'Middle Name',
    'dateOfBirth',
    'Date of Birth',
    'email',
    'Email',
    'phone',
    'Phone',
    'ssn',
    'Social Security Number'
  ]);

  /**
   * Get order data for a service, formatted with proper field labels
   *
   * @param orderItemId - The order item ID to fetch data for
   * @param orderSubject - The order subject data to check for duplicates
   * @returns Formatted order data as flat key-value pairs
   */
  static async getOrderDataForService(
    orderItemId: string | null,
    orderSubject: OrderSubject | Record<string, unknown> | null
  ): Promise<OrderData> {
    try {
      // Edge Case 3: OrderItem not found
      if (!orderItemId) {
        logger.warn('No orderItemId provided for order data fetch');
        return {};
      }

      // Business Rule 4: All fields from OrderData table must be included
      const orderDataRecords = await prisma.orderData.findMany({
        where: { orderItemId }
      });

      // Edge Case 1: No order data exists
      if (orderDataRecords.length === 0) {
        return {};
      }

      // Fetch workflow configuration for field labels
      // Business Rule 5: Field labels must come from workflow configuration
      let workflowConfig: WorkflowSection | null = null;
      try {
        // Try to get workflow configuration through the order item
        const firstRecord = orderDataRecords[0];
        if (firstRecord) {
          // NOTE: The WorkflowSection table currently doesn't have a sectionConfig field
          // This query is commented out until the database schema is updated
          // For now, we'll use the fallback field name formatting
          // Workflow configuration lookup is not yet implemented
          // Field labels will use the formatted field names from the database
          // This is acceptable as the field names are already human-readable
          // (e.g., "School Name", "Degree Type", etc.)
          // Future enhancement: integrate with workflow configuration when available
          workflowConfig = null;
        }
      } catch (error) {
        logger.warn('Failed to fetch workflow configuration', {
          error: error instanceof Error ? error.message : 'Unknown error',
          orderItemId
        });
      }

      // Build the order data object
      const orderData: OrderData = {};

      for (const record of orderDataRecords) {
        const { fieldName, fieldValue } = record;

        // Business Rule 3: Exclude subject information fields
        // Edge Case 9: Include all fields if duplicate detection fails
        //
        // WHY WE EXCLUDE SUBJECT INFORMATION FIELDS (to avoid duplication):
        // The order.subject JSON already contains personal information (name, DOB, email, SSN, phone)
        // that is displayed elsewhere in the UI. Including these fields in orderData would create
        // redundant data display where customers see the same information twice, creating confusion
        // and cluttering the interface. This keeps orderData focused on service-specific requirements.
        if (orderSubject && this.isSubjectField(fieldName)) {
          continue; // Skip this field
        }

        // Get the display label for the field
        //
        // WHY WE USE FALLBACK FIELD FORMATTING:
        // Edge Case 9: When subject is null (detection fails), use raw field names
        // to preserve data integrity and avoid any transformation that might lose information
        // This happens when:
        // 1. Order.subject field is corrupted/missing in database
        // 2. There's an error reading order subject during lookup
        // 3. Duplicate detection logic fails due to data inconsistency
        //
        // BUSINESS DECISION: Better to show raw field names than lose data completely
        // Users can still see what information was collected, even if labels aren't pretty
        let displayLabel = orderSubject === null
          ? fieldName  // WHY RAW FIELD NAME: When subject detection fails, use original field name to avoid any data loss
          : this.getFieldLabel(fieldName, workflowConfig);

        // Business Rule 9: Field values returned exactly as stored
        // Edge Case 6 & 7: Handle long values and special characters without modification
        orderData[displayLabel] = fieldValue;
      }

      return orderData;
    } catch (error) {
      // Edge Case 4: Database query fails
      //
      // WHY WE RETURN EMPTY OBJECT ON ERRORS:
      // Business Rule 8: orderData should be empty object, not null or undefined
      //
      // DESIGN DECISION: Service details page should still work even if order data fails
      // - Users can still see service status, vendor assignment, comments
      // - Order data is supplementary information, not critical for fulfillment workflow
      // - Empty object {} is safer than null (prevents UI crashes from .map() calls)
      // - Allows graceful degradation rather than complete page failure
      //
      // Alternative approaches considered and rejected:
      // - Throwing error: Would break entire service details page
      // - Returning null: Would require null checks throughout UI code
      // - Showing error message: Would confuse users when service data loads fine
      logger.error('Error fetching order data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderItemId
      });
      return {}; // Return empty object on error
    }
  }

  /**
   * Get the display label for a field
   *
   * @param fieldName - The raw field name from database
   * @param workflowConfig - The workflow configuration containing field definitions
   * @returns The display label for the field
   */
  private static getFieldLabel(fieldName: string, workflowConfig: WorkflowSection | null): string {
    // Try to find the field in workflow configuration
    if (workflowConfig?.sectionConfig?.fields) {
      const fields = workflowConfig.sectionConfig.fields;
      const field = fields.find((f: WorkflowField) => f.name === fieldName);

      // Edge Case 5: Field label is null or empty
      if (field?.label && field.label.trim() !== '') {
        return field.label;
      }
    }

    // Edge Case 2: Workflow has been deleted
    // Edge Case 10: Workflow configuration is corrupted
    // Business Rule 10: Fall back to raw field names with underscores converted to spaces
    //
    // WHY THIS FALLBACK APPROACH:
    // - Workflows can be deleted by admin users after orders are submitted
    // - Database doesn't enforce foreign key constraints on workflow deletion
    // - OrderData still exists but loses its display formatting context
    // - Raw field names (like "school_name") need to become readable ("School Name")
    // - This ensures data remains accessible even when workflow config is lost
    //
    // WHY FORMAT FIELD NAMES WHEN WORKFLOW CONFIG IS MISSING:
    // When workflow configurations are deleted or corrupted, we still need readable field labels.
    // Converting "school_name" to "School Name" ensures users can understand the data even when
    // the original form configuration is no longer available in the database.
    return this.formatFieldName(fieldName);
  }

  /**
   * Format a raw field name for display
   * Business Rule 10: Fallback uses fieldName with underscores converted to spaces
   *
   * @param fieldName - The raw field name
   * @returns Formatted field name for display
   */
  static formatFieldName(fieldName: string | null | undefined): string {
    if (!fieldName) return '';

    // Convert underscores to spaces and handle camelCase
    let formatted = fieldName.replace(/_/g, ' ');

    // Add space before capital letters in camelCase (but not at the start)
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');

    return formatted;
  }

  /**
   * Check if a field name is a subject information field
   * Business Rule 3: Subject Information fields must NOT be included
   *
   * @param fieldName - The field name to check
   * @returns True if the field is a subject information field
   */
  static isSubjectField(fieldName: string | null | undefined): boolean {
    if (!fieldName) return false;
    return this.SUBJECT_FIELDS.has(fieldName);
  }
}