// Types for comment templates and service comments
// These types are derived from the database schema and API responses

export interface CommentTemplate {
  id: string;
  name: string;
  templateText: string;
  placeholders: string[];
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceComment {
  id: string;
  serviceId: string;
  templateId: string;
  finalText: string;
  isInternalOnly: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
  // Status change fields
  isStatusChange?: boolean;
  statusChangedFrom?: string | null;
  statusChangedTo?: string | null;
  comment?: string | null;
  // Legacy name fields (for backwards compatibility)
  createdByName?: string | null;
  updatedByName?: string | null;
  templateName?: string | null;
  // Relations populated by API
  template?: CommentTemplate;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    userType?: string;
  };
  updatedByUser?: {
    id: string;
    name: string;
    email: string;
    userType?: string;
  } | null;
}

export interface CreateServiceCommentInput {
  templateId: string;
  finalText: string;
  isInternalOnly?: boolean; // Defaults to true on backend
}

export interface UpdateServiceCommentInput {
  finalText?: string;
  isInternalOnly?: boolean;
}

export interface ServiceCommentWithRelations extends ServiceComment {
  template: CommentTemplate;
  createdByUser: {
    id: string;
    name: string;
    email: string;
    userType?: string;
  };
  updatedByUser?: {
    id: string;
    name: string;
    email: string;
    userType?: string;
  } | null;
}