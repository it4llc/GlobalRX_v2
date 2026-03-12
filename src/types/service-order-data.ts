// Service Order Data Types

/**
 * Represents a workflow field configuration
 */
export interface WorkflowField {
  name: string;
  label?: string | null;
  type?: string;
  required?: boolean;
  description?: string;
}

/**
 * Workflow section configuration containing fields
 */
export interface WorkflowSectionConfig {
  fields?: WorkflowField[];
  [key: string]: unknown; // Allow other configuration properties
}

/**
 * Represents a workflow section from the database
 */
export interface WorkflowSection {
  id: string;
  workflowId: string;
  name: string;
  displayOrder: number;
  isRequired: boolean;
  dependsOnSection?: string | null;
  dependencyLogic?: string | null;
  createdAt: Date;
  updatedAt: Date;
  sectionConfig?: WorkflowSectionConfig | null;
}

/**
 * Order subject information
 * Contains personal information about the subject of the order
 */
export interface OrderSubject {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  ssn?: string;
  [key: string]: unknown; // Allow other subject fields
}

/**
 * Basic Order entity (partial, for use in related data)
 */
export interface OrderBasic {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  statusCode: string;
  subject: OrderSubject | Record<string, unknown>;
  totalPrice?: number | string | null;
  notes?: string | null;
  submittedAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignedVendorId?: string | null;
  closedAt?: Date | string | null;
  closedBy?: string | null;
}

/**
 * Basic OrderItem entity (partial, for use in related data)
 */
export interface OrderItemBasic {
  id: string;
  orderId: string;
  serviceId: string;
  locationId: string;
  status: string;
  price?: number | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  updatedById?: string | null;
}

/**
 * Basic Service entity (partial, for use in related data)
 */
export interface ServiceBasic {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  disabled: boolean;
  functionalityType: string;
  code: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Basic Location/Country entity (partial, for use in related data)
 */
export interface LocationBasic {
  id: string;
  name: string;
  code_2: string;
  code_3: string;
  numeric?: string | null;
  iso3166_2?: string | null;
  region?: string | null;
  subRegion?: string | null;
  regionCode?: string | null;
  subRegionCode?: string | null;
  [key: string]: unknown; // Allow other location fields
}

/**
 * Basic VendorOrganization entity (partial, for use in related data)
 */
export interface VendorOrganizationBasic {
  id: string;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  contactEmail: string;
  contactPhone: string;
  address?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}