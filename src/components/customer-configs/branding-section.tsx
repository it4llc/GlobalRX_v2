import React from 'react';
import { Input } from '@/components/ui/input';
import { CustomerDetails } from '@/types/customer';
import logger from '@/lib/client-logger';

interface BrandingSectionProps {
  customer: CustomerDetails;
  isEditMode: boolean;
  formData: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  onInputChange: (field: string, value: string) => void;
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// Utility function to determine best text color (black or white) based on background color
function getBestTextColor(hexColor: string): string {
  if (!hexColor || hexColor.length < 7) return '#000000';

  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function BrandingSection({
  customer,
  isEditMode,
  formData,
  onInputChange,
  onLogoChange,
}: BrandingSectionProps) {
  return (
    <div data-testid="branding-section" className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-300">
        <h3 className="text-sm font-semibold text-gray-900">Branding</h3>
      </div>

      <div className="divide-y divide-gray-200">
        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Logo</span>
          <div className="flex-1">
            {isEditMode ? (
              <div className="flex flex-col space-y-2">
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/svg+xml"
                  onChange={onLogoChange}
                />
                <p className="text-xs text-gray-500">Max size: 2MB. Formats: JPG, PNG, SVG</p>
                <p className="text-xs text-gray-500">Logos will be displayed at 200x200px maximum.</p>

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
                        onError={(e) => logger.error('Error loading image', { error: e })}
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
                      onError={(e) => logger.error('Error loading image', { error: e })}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-sm text-gray-500">No logo uploaded</span>
              )
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Primary Color</span>
          <div className="flex-1">
            {isEditMode ? (
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  id="primaryColor-picker"
                  value={formData.primaryColor || '#ffffff'}
                  onChange={(e) => onInputChange('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  id="primaryColor"
                  value={formData.primaryColor || ''}
                  onChange={(e) => onInputChange('primaryColor', e.target.value)}
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
                  <span className="text-sm text-gray-500">{customer.primaryColor}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Not specified</span>
              )
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Secondary Color</span>
          <div className="flex-1">
            {isEditMode ? (
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  id="secondaryColor-picker"
                  value={formData.secondaryColor || '#ffffff'}
                  onChange={(e) => onInputChange('secondaryColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  id="secondaryColor"
                  value={formData.secondaryColor || ''}
                  onChange={(e) => onInputChange('secondaryColor', e.target.value)}
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
                  <span className="text-sm text-gray-500">{customer.secondaryColor}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Not specified</span>
              )
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Accent Color</span>
          <div className="flex-1">
            {isEditMode ? (
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  id="accentColor-picker"
                  value={formData.accentColor || '#ffffff'}
                  onChange={(e) => onInputChange('accentColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  id="accentColor"
                  value={formData.accentColor || ''}
                  onChange={(e) => onInputChange('accentColor', e.target.value)}
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
                  <span className="text-sm text-gray-500">{customer.accentColor}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Not specified</span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}