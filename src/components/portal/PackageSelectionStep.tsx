// /GlobalRX_v2/src/components/portal/PackageSelectionStep.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { useTranslation } from '@/contexts/TranslationContext';
import { PackageOption } from '@/types/inviteCandidate';
import { ChevronRight } from 'lucide-react';

interface PackageSelectionStepProps {
  packages: PackageOption[];
  selectedPackageId?: string;
  onNext: (packageId: string) => void;
  isLoading: boolean;
}

export function PackageSelectionStep({
  packages,
  selectedPackageId: initialSelectedId,
  onNext,
  isLoading
}: PackageSelectionStepProps) {
  const { t } = useTranslation();
  const [selectedPackageId, setSelectedPackageId] = useState<string>(initialSelectedId || '');
  const [error, setError] = useState<string>('');

  const handleNext = () => {
    if (!selectedPackageId) {
      setError('Please select a package');
      return;
    }
    onNext(selectedPackageId);
  };

  const handlePackageChange = (packageId: string) => {
    setSelectedPackageId(packageId);
    setError(''); // Clear error when package is selected
  };

  // If no packages with workflows exist
  if (packages.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">
          {t('portal.inviteCandidate.noPackages')}
        </p>
      </div>
    );
  }

  const selectedPackage = packages.find(p => p.id === selectedPackageId);

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">
          {t('portal.inviteCandidate.step1Title')}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t('portal.inviteCandidate.stepIndicator').replace('{step}', '1')}
        </p>
      </div>

      {/* Package dropdown */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('portal.inviteCandidate.packageLabel')}
          <span className="text-red-500 ml-1">*</span>
        </label>

        <div data-testid="package-list" className="package-list">
          <StandardDropdown
            id="package-select"
            options={packages.map(pkg => ({
              id: pkg.id,
              value: pkg.id,
              label: pkg.name
            }))}
            value={selectedPackageId}
            onChange={handlePackageChange}
            placeholder={t('portal.inviteCandidate.packagePlaceholder')}
            disabled={isLoading}
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-1">{error}</p>
        )}
      </div>

      {/* Selected package and workflow details */}
      {selectedPackage && (selectedPackage.description || selectedPackage.workflow) && (
        <div className="bg-gray-50 p-4 rounded-md space-y-3">
          {/* Package details */}
          <div>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Selected Package:</span> {selectedPackage.name}
            </p>
            {selectedPackage.description && (
              <p className="text-sm text-gray-600 mt-1">
                {selectedPackage.description}
              </p>
            )}
          </div>

          {/* Workflow details */}
          {selectedPackage.workflow && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Workflow: {selectedPackage.workflow.name}
              </p>
              {selectedPackage.workflow.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {selectedPackage.workflow.description}
                </p>
              )}
              <div className="flex flex-col gap-1">
                <p className="text-xs text-gray-500">
                  • Expires in {selectedPackage.workflow.expirationDays} days
                </p>
                {selectedPackage.workflow.reminderEnabled && (
                  <p className="text-xs text-gray-500">
                    • Automatic reminders enabled
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleNext}
          disabled={isLoading || !selectedPackageId}
        >
          {t('portal.inviteCandidate.nextButton')}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}