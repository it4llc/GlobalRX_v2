'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Radio } from '@/components/ui/radio';
import { RadioGroup } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CustomerSelect } from '@/components/modules/customer/customer-select';
import { ServiceSelection } from '@/components/modules/customer/service-selection';

// Utility function to determine best text color (black or white) based on background color
function getBestTextColor(hexColor: string): string {
  // Default to black if no color is provided
  if (!hexColor || hexColor.length < 7) return '#000000';
  
  // Remove the hash if it exists
  const hex = hexColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance - standard formula for brightness perception
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Style objects for consistent component styling
const fullWidthStyle = {
  width: "100%"
};

interface CustomerDetails {
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
  // Branding fields
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  // Data retention setting
  dataRetentionDays?: number;
}

export default function CustomerDetailsPage() {
  const { id } = useParams();
  const { fetchWithAuth, checkPermission } = useAuth();
  const { t } = useTranslation();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    accountType: 'master' as 'master' | 'subaccount',
    masterAccountId: '',
    billingType: 'independent' as 'independent' | 'through_other',
    billingAccountId: '',
    invoiceTerms: '',
    invoiceContact: '',
    invoiceMethod: '',
    serviceIds: [] as string[],
    // Branding fields
    logoUrl: '',
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    // Data retention setting
    dataRetentionDays: 0
  });
  
  // State for logo preview and file
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Check if user has permission to edit customers
  const canEdit = checkPermission('customers', 'edit');
  
  useEffect(() => {
    const fetchCustomerInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch detailed customer info
        const response = await fetchWithAuth(`/api/customers/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch customer information');
        }
        
        const data = await response.json();
        
        // Check if we have a recently uploaded logo URL in session storage
        let logoUrl = data.logoUrl;
        try {
          const storedLogoUrl = typeof window !== 'undefined' ? 
            sessionStorage.getItem(`customer_${id}_logoUrl`) : null;
          
          if (storedLogoUrl) {
            console.log('Retrieved logo URL from session storage:', storedLogoUrl);
            logoUrl = storedLogoUrl;
            
            // Update the customer object with the stored logo URL
            data.logoUrl = storedLogoUrl;
            
            // Clear the stored value to prevent using it on future page loads
            sessionStorage.removeItem(`customer_${id}_logoUrl`);
          }
        } catch (storageErr) {
          console.warn('Error accessing session storage:', storageErr);
        }
        
        setCustomer(data);
        
        // Initialize form data
        setFormData({
          name: data.name || '',
          address: data.address || '',
          contactName: data.contactName || '',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          accountType: data.masterAccountId ? 'subaccount' : 'master',
          masterAccountId: data.masterAccountId || '',
          billingType: data.billingAccountId ? 'through_other' : 'independent',
          billingAccountId: data.billingAccountId || '',
          invoiceTerms: data.invoiceTerms || '',
          invoiceContact: data.invoiceContact || '',
          invoiceMethod: data.invoiceMethod || '',
          serviceIds: data.serviceIds || [],
          // Branding fields
          logoUrl: logoUrl || '',
          primaryColor: data.primaryColor || '',
          secondaryColor: data.secondaryColor || '',
          accentColor: data.accentColor || '',
          // Data retention setting
          dataRetentionDays: data.dataRetentionDays || 0
        });
      } catch (err) {
        console.error('Error fetching customer info:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchCustomerInfo();
    }
  }, [id, fetchWithAuth]);
  
  // Handle form field changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };
  
  // Upload logo file
  const uploadLogo = async (customerId: string, file: File) => {
    console.log('Uploading logo:', file.name, file.type, file.size);
    
    // Create FormData object and append file with explicit filename
    const formData = new FormData();
    formData.append('logo', file, file.name);
    
    console.log('FormData created with file:', file.name);

    try {
      console.log(`Sending logo upload to /api/customers/${customerId}/upload-logo`);
      
      // Use a direct fetch with credentials to avoid Content-Type header issues
      // that can occur with custom fetch wrappers
      const response = await fetch(`/api/customers/${customerId}/upload-logo`, {
        method: 'POST',
        body: formData,
        // DO NOT set Content-Type - browser must set it automatically with boundary
        credentials: 'include' // This ensures cookies are sent for session auth
      });

      // Get response as text first for debugging
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      // Parse the JSON response
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error(`Failed to parse server response: ${responseText.substring(0, 100)}...`);
      }
      
      if (!response.ok) {
        console.error('Logo upload failed:', result);
        throw new Error(`Failed to upload logo: ${result.error || response.statusText}`);
      }

      console.log('Logo upload successful:', result);
      
      if (result.warning) {
        console.warn('Upload warning:', result.warning);
      }
      
      return result;
    } catch (err) {
      console.error('Error in logo upload:', err);
      throw err;
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!customer) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Transform form data to API format
      const customerData = {
        name: formData.name,
        address: formData.address,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        masterAccountId: formData.accountType === 'subaccount' ? formData.masterAccountId : null,
        billingAccountId: formData.billingType === 'through_other' ? formData.billingAccountId : null,
        invoiceTerms: formData.invoiceTerms,
        invoiceContact: formData.invoiceContact,
        invoiceMethod: formData.invoiceMethod,
        serviceIds: formData.serviceIds,
        // Branding fields
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        accentColor: formData.accentColor,
        // Data retention setting
        dataRetentionDays: formData.dataRetentionDays === 0 ? null : formData.dataRetentionDays
      };
      
      // Update customer
      const response = await fetchWithAuth(`/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(customerData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update customer');
      }
      
      // Update local state with the new data
      const updatedData = await response.json();
      setCustomer(updatedData);
      
      // Upload logo if one was selected
      if (logoFile) {
        try {
          console.log('Logo file selected, attempting upload...');
          const uploadResult = await uploadLogo(id as string, logoFile);
          console.log('Upload result:', uploadResult);
          
          // Update the customer data with the new logo URL immediately
          if (uploadResult && uploadResult.logoUrl) {
            // Update local state
            setCustomer(prev => prev ? { 
              ...prev, 
              logoUrl: uploadResult.logoUrl 
            } : null);
            
            // Store the updated logo URL in sessionStorage to persist through page reload
            try {
              sessionStorage.setItem(`customer_${id}_logoUrl`, uploadResult.logoUrl);
              console.log('Saved logo URL to session storage for retrieval after reload');
            } catch (storageErr) {
              console.warn('Failed to store logo URL in session storage:', storageErr);
            }
          }
        } catch (logoErr) {
          console.error('Error uploading logo:', logoErr);
          // Show error but don't prevent saving other fields
          setError(`Customer saved, but logo upload failed: ${logoErr instanceof Error ? logoErr.message : 'Unknown error'}`);
        }
      }
  
      // Exit edit mode
      setIsEditMode(false);
      
      // Refresh the page to ensure all changes (including logo) are displayed
      window.location.reload();
    } catch (err) {
      console.error('Error updating customer:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    // Reset form data to current customer data
    if (customer) {
      setFormData({
        name: customer.name || '',
        address: customer.address || '',
        contactName: customer.contactName || '',
        contactEmail: customer.contactEmail || '',
        contactPhone: customer.contactPhone || '',
        accountType: customer.masterAccountId ? 'subaccount' : 'master',
        masterAccountId: customer.masterAccountId || '',
        billingType: customer.billingAccountId ? 'through_other' : 'independent',
        billingAccountId: customer.billingAccountId || '',
        invoiceTerms: customer.invoiceTerms || '',
        invoiceContact: customer.invoiceContact || '',
        invoiceMethod: customer.invoiceMethod || '',
        serviceIds: customer.serviceIds || [],
        // Branding fields
        logoUrl: customer.logoUrl || '',
        primaryColor: customer.primaryColor || '',
        secondaryColor: customer.secondaryColor || '',
        accentColor: customer.accentColor || '',
        // Data retention setting
        dataRetentionDays: customer.dataRetentionDays || 0
      });
    }
    
    // Clear logo file
    setLogoFile(null);
    
    // Exit edit mode
    setIsEditMode(false);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }
  
  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Customer"
        message={error}
        action={
          <Button onClick={() => window.location.reload()}>Retry</Button>
        }
      />
    );
  }
  
  if (!customer) {
    return (
      <AlertBox
        type="warning"
        title="Customer Not Found"
        message="This customer does not exist or you don't have permission to view it."
      />
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {t('module.customerConfig.customerDetails')}
        </h2>
        
        <div className="flex space-x-3">
          {!isEditMode && (
            <>
              {canEdit && (
                <Button onClick={() => setIsEditMode(true)}>
                  {t('module.customerConfig.editCustomer')}
                </Button>
              )}
            </>
          )}
          
          {isEditMode && (
            <>
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <AlertBox
          type="error"
          title="Error"
          message={error}
          className="mb-6"
        />
      )}
      
      <div className="w-full">
        {/* Single combined table */}
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full border-collapse border-0">
            {/* Basic Information Section */}
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-300" style={{ textAlign: 'left' }}>
                  Basic Information
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Name</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter customer name"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.name
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Address</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter address"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.address || 'Not specified'
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Contact Name</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.contactName}
                      onChange={(e) => handleInputChange('contactName', e.target.value)}
                      placeholder="Enter contact person's name"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.contactName || 'Not specified'
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Contact Email</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      placeholder="Enter contact email"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.contactEmail || 'Not specified'
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Contact Phone</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      placeholder="Enter contact phone number"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.contactPhone || 'Not specified'
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Status</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    customer.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {customer.disabled ? 'Disabled' : 'Active'}
                  </span>
                </td>
              </tr>

              {/* Account Relationships Section */}
              <tr className="h-8">
                <td colSpan={2} className="border-0"></td>
              </tr>
              <tr>
                <th scope="col" colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 bg-gray-50 border-t border-b border-gray-300" style={{ textAlign: 'left' }}>
                  Account Relationships
                </th>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Account Type</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <RadioGroup
                      value={formData.accountType}
                      onValueChange={(value) => handleInputChange('accountType', value)}
                      className="flex space-x-8"
                      style={{ width: "100%" }}
                    >
                      <div className="flex items-center">
                        <Radio
                          id="account-type-master"
                          value="master"
                          checked={formData.accountType === "master"}
                        />
                        <Label htmlFor="account-type-master" className="ml-2">Master Account</Label>
                      </div>
                      <div className="flex items-center">
                        <Radio
                          id="account-type-subaccount"
                          value="subaccount"
                          checked={formData.accountType === "subaccount"}
                        />
                        <Label htmlFor="account-type-subaccount" className="ml-2">Subaccount</Label>
                      </div>
                    </RadioGroup>
                  ) : (
                    customer.masterAccountId ? 'Subaccount' : 'Master Account'
                  )}
                </td>
              </tr>
              {(customer.masterAccount || (isEditMode && formData.accountType === 'subaccount')) && (
                <tr>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Master Account</td>
                  <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                    {isEditMode && formData.accountType === 'subaccount' ? (
                      <CustomerSelect
                        id="masterAccountId"
                        value={formData.masterAccountId}
                        onChange={(value) => handleInputChange('masterAccountId', value)}
                        placeholder="Select master account"
                        excludeIds={[typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '']}
                        className="w-full"
                        style={fullWidthStyle}
                      />
                    ) : (
                      customer.masterAccount?.name || ''
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Billing Type</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <RadioGroup
                      value={formData.billingType}
                      onValueChange={(value) => handleInputChange('billingType', value)}
                      className="flex space-x-8"
                      style={{ width: "100%" }}
                    >
                      <div className="flex items-center">
                        <Radio
                          id="billing-type-independent"
                          value="independent"
                          checked={formData.billingType === "independent"}
                        />
                        <Label htmlFor="billing-type-independent" className="ml-2">Bills Independently</Label>
                      </div>
                      <div className="flex items-center">
                        <Radio
                          id="billing-type-through-other"
                          value="through_other"
                          checked={formData.billingType === "through_other"}
                        />
                        <Label htmlFor="billing-type-through-other" className="ml-2">Bills Through Another</Label>
                      </div>
                    </RadioGroup>
                  ) : (
                    customer.billingAccountId ? 'Bills Through Another Account' : 'Bills Independently'
                  )}
                </td>
              </tr>
              {(customer.billingAccount || (isEditMode && formData.billingType === 'through_other')) && (
                <tr>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Billing Account</td>
                  <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                    {isEditMode && formData.billingType === 'through_other' ? (
                      <CustomerSelect
                        id="billingAccountId"
                        value={formData.billingAccountId}
                        onChange={(value) => handleInputChange('billingAccountId', value)}
                        placeholder="Select billing account"
                        excludeIds={[typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '']}
                        className="w-full"
                        style={fullWidthStyle}
                      />
                    ) : (
                      customer.billingAccount?.name || ''
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Subaccounts</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">{customer.subaccountsCount}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Service Packages</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">{customer.packagesCount}</td>
              </tr>

              {/* Invoice Details Section */}
              <tr className="h-8">
                <td colSpan={2} className="border-0"></td>
              </tr>
              <tr>
                <th scope="col" colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 bg-gray-50 border-t border-b border-gray-300" style={{ textAlign: 'left' }}>
                  Invoice Details
                </th>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Invoice Terms</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.invoiceTerms}
                      onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                      placeholder="Enter invoice terms"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.invoiceTerms || 'Not specified'
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Invoice Contact</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.invoiceContact}
                      onChange={(e) => handleInputChange('invoiceContact', e.target.value)}
                      placeholder="Enter invoice contact"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.invoiceContact || 'Not specified'
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Invoice Method</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      value={formData.invoiceMethod}
                      onChange={(e) => handleInputChange('invoiceMethod', e.target.value)}
                      placeholder="Enter invoice delivery method"
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  ) : (
                    customer.invoiceMethod || 'Not specified'
                  )}
                </td>
              </tr>

              {/* Branding Section */}
              <tr className="h-8">
                <td colSpan={2} className="border-0"></td>
              </tr>
              <tr>
                <th scope="col" colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 bg-gray-50 border-t border-b border-gray-300" style={{ textAlign: 'left' }}>
                  Branding
                </th>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Logo</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <div className="flex flex-col space-y-2">
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/svg+xml"
                        onChange={handleLogoChange}
                      />
                      <p className="text-xs text-gray-500">Max size: 2MB. Formats: JPG, PNG, SVG</p>
                      <p className="text-xs text-gray-500">Logos will be displayed at 200x200px maximum.</p>
                      
                      {/* Show current logo if it exists */}
                      {formData.logoUrl && (
                        <div className="mt-2 p-2 border rounded">
                          <p className="text-sm mb-1">Current Logo:</p>
                          <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-50 relative overflow-hidden">
                            <img 
                              src={formData.logoUrl} 
                              alt="Customer logo" 
                              className="max-w-[200px] max-h-[200px] object-contain w-auto h-auto" 
                              style={{ 
                                maxWidth: '200px',
                                maxHeight: '200px',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain'
                              }}
                              onError={(e) => console.error('Error loading image:', e)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    customer.logoUrl ? (
                      <div className="p-2 border rounded inline-block">
                        <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-50 relative overflow-hidden">
                          <img 
                            src={customer.logoUrl} 
                            alt="Customer logo" 
                            className="max-w-[200px] max-h-[200px] object-contain w-auto h-auto" 
                            style={{ 
                              maxWidth: '200px',
                              maxHeight: '200px',
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain'
                            }}
                            onError={(e) => console.error('Error loading image:', e)}
                          />
                        </div>
                      </div>
                    ) : (
                      'No logo uploaded'
                    )
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Primary Color</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        id="primaryColor-picker"
                        value={formData.primaryColor || '#ffffff'}
                        onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        id="primaryColor"
                        value={formData.primaryColor || ''}
                        onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                        placeholder="#RRGGBB"
                        className="w-40"
                      />
                    </div>
                  ) : (
                    customer.primaryColor ? (
                      <div className="flex items-center">
                        <div 
                          className="w-24 h-24 rounded border border-gray-300 mr-4 shadow-sm flex items-center justify-center" 
                          style={{ 
                            backgroundColor: customer.primaryColor,
                            color: getBestTextColor(customer.primaryColor)
                          }}
                        >
                          <span className="text-xs font-mono">{customer.primaryColor}</span>
                        </div>
                        <span>{customer.primaryColor}</span>
                      </div>
                    ) : (
                      'Not specified'
                    )
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Secondary Color</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        id="secondaryColor-picker"
                        value={formData.secondaryColor || '#ffffff'}
                        onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        id="secondaryColor"
                        value={formData.secondaryColor || ''}
                        onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                        placeholder="#RRGGBB"
                        className="w-40"
                      />
                    </div>
                  ) : (
                    customer.secondaryColor ? (
                      <div className="flex items-center">
                        <div 
                          className="w-24 h-24 rounded border border-gray-300 mr-4 shadow-sm flex items-center justify-center" 
                          style={{ 
                            backgroundColor: customer.secondaryColor,
                            color: getBestTextColor(customer.secondaryColor)
                          }}
                        >
                          <span className="text-xs font-mono">{customer.secondaryColor}</span>
                        </div>
                        <span>{customer.secondaryColor}</span>
                      </div>
                    ) : (
                      'Not specified'
                    )
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Accent Color</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        id="accentColor-picker"
                        value={formData.accentColor || '#ffffff'}
                        onChange={(e) => handleInputChange('accentColor', e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <Input
                        id="accentColor"
                        value={formData.accentColor || ''}
                        onChange={(e) => handleInputChange('accentColor', e.target.value)}
                        placeholder="#RRGGBB"
                        className="w-40"
                      />
                    </div>
                  ) : (
                    customer.accentColor ? (
                      <div className="flex items-center">
                        <div 
                          className="w-24 h-24 rounded border border-gray-300 mr-4 shadow-sm flex items-center justify-center" 
                          style={{ 
                            backgroundColor: customer.accentColor,
                            color: getBestTextColor(customer.accentColor)
                          }}
                        >
                          <span className="text-xs font-mono">{customer.accentColor}</span>
                        </div>
                        <span>{customer.accentColor}</span>
                      </div>
                    ) : (
                      'Not specified'
                    )
                  )}
                </td>
              </tr>
              
              {/* Data Retention Section */}
              <tr className="h-8">
                <td colSpan={2} className="border-0"></td>
              </tr>
              <tr>
                <th scope="col" colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 bg-gray-50 border-t border-b border-gray-300" style={{ textAlign: 'left' }}>
                  Data Retention
                </th>
              </tr>
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>Retention Period (Days)</td>
                <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">
                  {isEditMode ? (
                    <Input
                      id="dataRetentionDays"
                      type="number"
                      min="1"
                      value={formData.dataRetentionDays || ''}
                      onChange={(e) => handleInputChange('dataRetentionDays', parseInt(e.target.value) || 0)}
                      placeholder="Enter retention period in days"
                      className="w-40"
                    />
                  ) : (
                    customer.dataRetentionDays ? `${customer.dataRetentionDays} days` : 'Not specified'
                  )}
                </td>
              </tr>
              
              {/* Services Section */}
              <tr className="h-8">
                <td colSpan={2} className="border-0"></td>
              </tr>
              <tr>
                <th scope="col" colSpan={2} className="px-6 py-3 text-left text-sm font-semibold text-gray-900 bg-gray-50 border-t border-b border-gray-300" style={{ textAlign: 'left' }}>
                  Available Services
                </th>
              </tr>
              {isEditMode ? (
                <tr>
                  <td colSpan={2} className="px-6 py-3 border-b border-gray-200">
                    <ServiceSelection
                      value={formData.serviceIds}
                      onChange={(selectedIds) => handleInputChange('serviceIds', selectedIds)}
                      className="w-full"
                      style={fullWidthStyle}
                    />
                  </td>
                </tr>
              ) : (
                customer.services && customer.services.length > 0 ? (
                  customer.services.map((service, index) => (
                    <tr key={service.id}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 border-b border-gray-200 whitespace-nowrap" style={{ width: '200px' }}>{service.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500 border-b border-gray-200">{service.category}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-6 py-3 text-sm text-gray-500 text-center border-b border-gray-200">
                      No services available
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isEditMode && (
        <div className="flex justify-end gap-4 mt-8">
          <Button 
            variant="outline" 
            onClick={handleCancelEdit}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}