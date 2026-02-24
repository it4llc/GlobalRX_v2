// Shared types for the order creation flow

export interface SubjectInfo {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
}

export interface AvailableService {
  id: string;
  name: string;
  category: string;
}

export interface AvailableLocation {
  id: string;
  name: string;
  code2?: string;
  code?: string;
  available: boolean;
  hasSublocations: boolean;
  level?: number;
}

export interface ServiceItem {
  serviceId: string;
  serviceName: string;
  locationId: string;
  locationName: string;
  itemId: string; // Unique ID for this service+location combination
}

export interface OrderFormData {
  serviceItems: ServiceItem[];
  subject: SubjectInfo;
  notes: string;
}

export interface OrderRequirements {
  subjectFields: any[];
  searchFields: any[];
  documents: any[];
}

export interface MissingRequirements {
  subjectFields: Array<{ fieldName: string; serviceLocation: string }>;
  searchFields: Array<{ fieldName: string; serviceLocation: string }>;
  documents: Array<{ documentName: string; serviceLocation: string }>;
}

export interface OrderFormState {
  step: number;
  isEditMode: boolean;
  editOrderId: string | null;
  isLoadingOrder: boolean;
  isSubmitting: boolean;
  formData: OrderFormData;
  selectedServiceForLocation: AvailableService | null;
  selectedCountry: string;
  errors: Record<string, string>;

  // Requirements state
  requirements: OrderRequirements;
  subjectFieldValues: Record<string, any>;
  searchFieldValues: Record<string, Record<string, any>>;
  uploadedDocuments: Record<string, File>;

  // Dialog state
  showMissingRequirementsDialog: boolean;
  missingRequirements: MissingRequirements;

  // Data loading state
  availableServices: AvailableService[];
  loadingServices: boolean;
  availableLocations: AvailableLocation[];
  loadingLocations: boolean;
  sublocations: { [parentId: string]: AvailableLocation[] };
}