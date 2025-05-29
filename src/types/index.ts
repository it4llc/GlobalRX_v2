// src/types/index.ts

// Location hierarchy types
export interface Subregion {
  id: string;
  name: string;
  level: number; // 1 = subregion1, 2 = subregion2, 3 = subregion3
  parentId: string;
  subregions?: Subregion[];
  expanded?: boolean;
}

export interface Country {
  id: string;
  name: string;
  code_2: string;
  code_3: string;
  numeric?: string;
  expanded?: boolean;
  subregions?: Subregion[];
}

// Requirement types
export interface DataField {
  id: string;
  fieldLabel: string;
  shortName: string;
  dataType: string;
  instructions?: string;
  retentionHandling?: string;
}

export interface Document {
  id: string;
  documentName: string;
  instructions?: string;
  scope: string;
  fileUrl?: string;
}

export interface Form {
  id: string;
  formName: string;
  description?: string;
}

export type RequirementType = 'field' | 'document' | 'form';

export interface Requirement {
  id: string;
  name: string;
  type: RequirementType;
  field?: DataField;
  document?: Document;
  form?: Form;
}

// Requirement mapping
export interface RequirementMapping {
  serviceId: string;
  locationId: string; // Country ID or subregion ID
  requirementId: string;
  required: boolean;
}

// Service type
export interface Service {
  id: string;
  name: string;
  category: string;
  description?: string;
  functionalityType: string;
}