export interface CustomerDetails {
  id: string;
  name: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  masterAccountId?: string;
  masterAccount?: { id: string; name: string };
  billingAccountId?: string;
  billingAccount?: { id: string; name: string };
  invoiceTerms?: string;
  invoiceContact?: string;
  invoiceMethod?: string;
  disabled: boolean;
  subaccountsCount: number;
  packagesCount: number;
  serviceIds: string[];
  services: Array<{ id: string; name: string; category: string }>;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  dataRetentionDays?: number;
}