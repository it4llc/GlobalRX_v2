import { useMemo } from 'react';
import { OrderFormState, OrderRequirements, MissingRequirements } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ValidationStepResult {
  isValid: boolean;
  missing: MissingRequirements;
}

/**
 * Custom hook for order form validation logic
 * Extracted from the large order form component
 */
export function useOrderValidation() {

  /**
   * Validate step 1 - Service and location selection
   */
  const validateStep1 = (serviceItems: any[]): ValidationResult => {
    const errors: Record<string, string> = {};

    if (serviceItems.length === 0) {
      errors.services = 'Please add at least one service to your order';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  /**
   * Validate step 2 - Subject information
   * Returns true to allow navigation (validation happens at submission)
   */
  const validateStep2 = (): boolean => {
    return true;
  };

  /**
   * Validate step 3 - Search details
   * Returns true to allow navigation (validation happens at submission)
   */
  const validateStep3 = (): boolean => {
    return true;
  };

  /**
   * Check if an address block has meaningful data
   */
  const hasAddressBlockData = (fieldValue: any): boolean => {
    return !!(fieldValue &&
      typeof fieldValue === 'object' &&
      (
        (fieldValue.street1 && typeof fieldValue.street1 === 'string' && fieldValue.street1.trim()) ||
        (fieldValue.city && typeof fieldValue.city === 'string' && fieldValue.city.trim()) ||
        (fieldValue.state && typeof fieldValue.state === 'string' && fieldValue.state.trim()) ||
        (fieldValue.postalCode && typeof fieldValue.postalCode === 'string' && fieldValue.postalCode.trim())
      ));
  };

  /**
   * Comprehensive validation for missing requirements
   * Checks all required fields, address blocks, and documents
   */
  const checkMissingRequirements = (
    requirements: OrderRequirements,
    serviceItems: any[],
    subjectFieldValues: Record<string, any>,
    searchFieldValues: Record<string, Record<string, any>>,
    uploadedDocuments: Record<string, File>
  ): ValidationStepResult => {
    const missing: MissingRequirements = {
      subjectFields: [],
      searchFields: [],
      documents: []
    };

    // Check subject fields - each field can be individually required per Data RX/DSX config
    requirements.subjectFields.forEach((field: any) => {
      if (field.required) {
        const fieldValue = subjectFieldValues[field.id];

        if (field.dataType === 'address_block') {
          if (!hasAddressBlockData(fieldValue)) {
            missing.subjectFields.push({
              fieldName: field.name,
              serviceLocation: 'All services'
            });
          }
        } else {
          // Regular field validation
          if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
            missing.subjectFields.push({
              fieldName: field.name,
              serviceLocation: 'All services'
            });
          }
        }
      }
    });

    // Check search fields per service item
    serviceItems.forEach(item => {
      const itemFields = requirements.searchFields.filter(
        (field: any) => field.serviceId === item.serviceId && field.locationId === item.locationId
      );

      itemFields.forEach((field: any) => {
        if (field.required) {
          const fieldValue = searchFieldValues[item.itemId]?.[field.id];

          if (field.dataType === 'address_block') {
            if (!hasAddressBlockData(fieldValue)) {
              missing.searchFields.push({
                fieldName: field.name,
                serviceLocation: `${item.serviceName} - ${item.locationName}`
              });
            }
          } else {
            if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
              missing.searchFields.push({
                fieldName: field.name,
                serviceLocation: `${item.serviceName} - ${item.locationName}`
              });
            }
          }
        }
      });
    });

    // Check documents - each can be individually required per Data RX/DSX config
    requirements.documents.forEach((document: any) => {
      if (document.required && !uploadedDocuments[document.id]) {
        missing.documents.push({
          documentName: document.name,
          serviceLocation: document.scope === 'per_case' ? 'All services' : 'Service specific'
        });
      }
    });

    const isValid =
      missing.subjectFields.length === 0 &&
      missing.searchFields.length === 0 &&
      missing.documents.length === 0;

    return { isValid, missing };
  };

  /**
   * Check if a step is complete based on current form state
   */
  const isStepComplete = (
    stepNumber: number,
    serviceItems: any[],
    requirements: OrderRequirements,
    subjectFieldValues: Record<string, any>,
    searchFieldValues: Record<string, Record<string, any>>,
    uploadedDocuments: Record<string, File>,
    currentStep: number
  ): boolean => {
    switch (stepNumber) {
      case 1:
        return serviceItems.length > 0;

      case 2:
        // If no subject fields required and we've moved past this step
        if (requirements.subjectFields.length === 0 && currentStep > 2) {
          return true;
        }
        // Check that all required subject fields are filled
        return requirements.subjectFields.length > 0 &&
               requirements.subjectFields.every((field: any) =>
                 !field.required || subjectFieldValues[field.id]
               );

      case 3:
        // Only consider complete if we've reached step 3
        if (currentStep < 3) return false;

        // Check each service item for required search fields
        return serviceItems.every(item => {
          const itemFields = requirements.searchFields.filter(
            (field: any) => field.serviceId === item.serviceId && field.locationId === item.locationId
          );
          // If no fields for this item, it's complete
          if (itemFields.length === 0) return true;
          // Check that all required fields are filled
          return itemFields.every((field: any) =>
            !field.required || searchFieldValues[item.itemId]?.[field.id]
          );
        });

      case 4:
        // Only consider complete if we've reached step 4
        if (currentStep < 4) return false;
        // If no documents required, it's complete
        if (requirements.documents.length === 0) return true;
        // Check that all required documents are uploaded
        return requirements.documents.every((document: any) =>
          !document.required || uploadedDocuments[document.id]
        );

      default:
        return false;
    }
  };

  /**
   * Convert UUID-based field values to name-based for storage
   */
  const convertSubjectFieldsToNameBased = (
    fieldValues: Record<string, any>,
    fields: any[]
  ): Record<string, any> => {
    const result: Record<string, any> = {};

    Object.entries(fieldValues).forEach(([fieldId, value]) => {
      const field = fields.find(f => f.id === fieldId);
      if (field && value) {
        result[field.name] = value;
      }
    });

    return result;
  };

  /**
   * Convert search field values per item to name-based for storage
   */
  const convertSearchFieldsToNameBased = (
    fieldValues: Record<string, Record<string, any>>,
    fields: any[]
  ): Record<string, Record<string, any>> => {
    const result: Record<string, Record<string, any>> = {};

    Object.entries(fieldValues).forEach(([itemId, itemFields]) => {
      result[itemId] = {};
      Object.entries(itemFields).forEach(([fieldId, value]) => {
        const field = fields.find(f => f.id === fieldId);
        if (field && value) {
          result[itemId][field.name] = value;
        }
      });
    });

    return result;
  };

  return {
    validateStep1,
    validateStep2,
    validateStep3,
    checkMissingRequirements,
    isStepComplete,
    convertSubjectFieldsToNameBased,
    convertSearchFieldsToNameBased,
    hasAddressBlockData
  };
}