// /GlobalRX_v2/src/types/service-comment.ts

import { z } from 'zod';
import { createServiceCommentSchema, updateServiceCommentSchema } from '@/lib/validations/service-comment';

// Infer types from Zod schemas
export type CreateServiceCommentInput = z.infer<typeof createServiceCommentSchema>;
export type UpdateServiceCommentInput = z.infer<typeof updateServiceCommentSchema>;

// Database model types
export interface ServiceComment {
  id: string;
  serviceId: string;
  templateId: string;
  finalText: string;
  isInternalOnly: boolean;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}

// Extended types with relations
export interface ServiceCommentWithRelations extends ServiceComment {
  template: {
    id: string;
    shortName: string;
    longName: string;
  };
  createdByUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  updatedByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

// API Response types
export interface ServiceCommentResponse {
  id: string;
  serviceId: string;
  templateId: string;
  finalText: string;
  isInternalOnly: boolean;
  createdBy: string;
  createdAt: string; // ISO 8601 string
  updatedBy: string | null;
  updatedAt: string | null; // ISO 8601 string
  template: {
    shortName: string;
    longName: string;
  };
  createdByUser: {
    name: string;
    email: string;
  };
  updatedByUser?: {
    name: string;
    email: string;
  } | null;
}

export interface GetServiceCommentsResponse {
  comments: ServiceCommentResponse[];
  total: number;
}

export interface OrderServiceCommentsResponse {
  serviceComments: {
    [serviceId: string]: {
      serviceName: string;
      serviceStatus: string;
      comments: ServiceCommentResponse[];
      total: number;
    };
  };
}