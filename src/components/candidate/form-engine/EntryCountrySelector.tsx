// /GlobalRX_v2/src/components/candidate/form-engine/EntryCountrySelector.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Country {
  id: string;
  name: string;
}

interface EntryCountrySelectorProps {
  value: string | null;
  onChange: (countryId: string) => void;
  countries: Country[];
  disabled?: boolean;
}

/**
 * Entry Country Selector Component
 *
 * Country dropdown for individual entries.
 * Uses native select on mobile for better UX.
 */
export function EntryCountrySelector({
  value,
  onChange,
  countries,
  disabled = false
}: EntryCountrySelectorProps) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile on mount
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use native select on mobile
  if (isMobile) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('candidate.portal.selectCountryForEntry')}
        </label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">
            {t('candidate.portal.selectCountryForEntry')}
          </option>
          {countries.map(country => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Use shadcn Select on desktop
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t('candidate.portal.selectCountryForEntry')}
      </label>
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full min-h-[44px] text-base">
          <SelectValue placeholder={t('candidate.portal.selectCountryForEntry')} />
        </SelectTrigger>
        <SelectContent>
          {countries.map(country => (
            <SelectItem key={country.id} value={country.id}>
              {country.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}