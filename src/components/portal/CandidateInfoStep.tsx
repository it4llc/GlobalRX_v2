// /GlobalRX_v2/src/components/portal/CandidateInfoStep.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { FormTable, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { InviteFormData } from '@/types/inviteCandidate';
import { createInvitationSchema } from '@/lib/validations/candidateInvitation';

interface CandidateInfoStepProps {
  formData: Partial<InviteFormData>;
  onBack: () => void;
  onSubmit: (data: InviteFormData) => void;
  isSubmitting: boolean;
}

// Static list of common country codes
const COUNTRY_CODES = [
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+86', label: '+86 (CN)' },
  { code: '+91', label: '+91 (IN)' },
  { code: '+61', label: '+61 (AU)' },
  { code: '+33', label: '+33 (FR)' },
  { code: '+49', label: '+49 (DE)' },
  { code: '+81', label: '+81 (JP)' },
  { code: '+52', label: '+52 (MX)' },
  { code: '+55', label: '+55 (BR)' }
];

export function CandidateInfoStep({
  formData: initialData,
  onBack,
  onSubmit,
  isSubmitting
}: CandidateInfoStepProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<InviteFormData>>({
    ...initialData,
    phoneCountryCode: initialData.phoneCountryCode || '+1'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof InviteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Special validation for phone fields
    if (field === 'phoneNumber' && value && !formData.phoneCountryCode) {
      // If user enters phone number but no country code is selected, show error
      setErrors(prev => ({
        ...prev,
        phoneCountryCode: 'Phone country code is required when phone number is provided'
      }));
    } else if (field === 'phoneCountryCode' && value && errors.phoneCountryCode) {
      // Clear phoneCountryCode error when user selects a country code
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.phoneCountryCode;
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    // Validate form data
    const validation = createInvitationSchema.safeParse(formData);

    if (!validation.success) {
      // Map Zod errors to field errors
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) {
          const field = err.path[0].toString();
          if (!fieldErrors[field]) {
            fieldErrors[field] = err.message;
          }
        }
      });
      setErrors(fieldErrors);
      return;
    }

    onSubmit(validation.data);
  };

  // Validate email on blur
  const handleEmailBlur = () => {
    const email = formData.email || '';
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setErrors(prev => ({
        ...prev,
        email: t('portal.inviteCandidate.emailValidation')
      }));
    }
  };

  // Validate phone on blur
  const handlePhoneBlur = () => {
    const phoneNumber = formData.phoneNumber || '';
    if (phoneNumber && !formData.phoneCountryCode) {
      setErrors(prev => ({
        ...prev,
        phoneCountryCode: 'Phone country code is required when phone number is provided'
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">
          {t('portal.inviteCandidate.step2Title')}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t('portal.inviteCandidate.stepIndicator').replace('{step}', '2')}
        </p>
      </div>

      <FormTable>
        {/* First Name */}
        <FormRow
          label={t('portal.inviteCandidate.firstNameLabel')}
          htmlFor="firstName"
          required={true}
          error={errors.firstName}
        >
          <Input
            id="firstName"
            name="firstName"
            data-testid="firstName"
            value={formData.firstName || ''}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            disabled={isSubmitting}
            required
            maxLength={100}
          />
        </FormRow>

        {/* Last Name */}
        <FormRow
          label={t('portal.inviteCandidate.lastNameLabel')}
          htmlFor="lastName"
          required={true}
          error={errors.lastName}
        >
          <Input
            id="lastName"
            name="lastName"
            data-testid="lastName"
            value={formData.lastName || ''}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            disabled={isSubmitting}
            required
            maxLength={100}
          />
        </FormRow>

        {/* Email */}
        <FormRow
          label={t('portal.inviteCandidate.emailLabel')}
          htmlFor="email"
          required={true}
          error={errors.email}
        >
          <Input
            id="email"
            name="email"
            data-testid="email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            onBlur={handleEmailBlur}
            disabled={isSubmitting}
            required
            maxLength={254}
          />
        </FormRow>

        {/* Phone Country Code */}
        <FormRow
          label={t('portal.inviteCandidate.phoneCountryCodeLabel')}
          htmlFor="phoneCountryCode"
          error={errors.phoneCountryCode}
        >
          <select
            id="phoneCountryCode"
            name="phoneCountryCode"
            data-testid="phoneCountryCode"
            value={formData.phoneCountryCode || '+1'}
            onChange={(e) => handleInputChange('phoneCountryCode', e.target.value)}
            disabled={isSubmitting}
            className="w-full h-7 px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COUNTRY_CODES.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>

        {/* Phone Number */}
        <FormRow
          label={t('portal.inviteCandidate.phoneNumberLabel')}
          htmlFor="phoneNumber"
          error={errors.phoneNumber}
        >
          <Input
            id="phoneNumber"
            name="phoneNumber"
            data-testid="phoneNumber"
            value={formData.phoneNumber || ''}
            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
            onBlur={handlePhoneBlur}
            disabled={isSubmitting}
            maxLength={20}
          />
        </FormRow>
      </FormTable>

      {/* Action buttons */}
      <div className="flex justify-between pt-4">
        <Button
          onClick={onBack}
          variant="outline"
          disabled={isSubmitting}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : t('portal.inviteCandidate.createButton')}
        </Button>
      </div>

      {/* Show validation errors for missing fields */}
      {errors.firstName && (
        <div className="text-red-600 text-sm" data-testid="firstName-error">
          {errors.firstName}
        </div>
      )}
      {errors.lastName && (
        <div className="text-red-600 text-sm" data-testid="lastName-error">
          {errors.lastName}
        </div>
      )}
      {errors.email && !formData.email && (
        <div className="text-red-600 text-sm" data-testid="email-error">
          {errors.email}
        </div>
      )}
    </div>
  );
}