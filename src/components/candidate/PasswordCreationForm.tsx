// /GlobalRX_v2/src/components/candidate/PasswordCreationForm.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/contexts/TranslationContext';

// Form schema with password and confirm password fields
const formSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

type FormValues = z.infer<typeof formSchema>;

interface PasswordCreationFormProps {
  token: string;
  onSuccess: () => void;
}

export function PasswordCreationForm({ token, onSuccess }: PasswordCreationFormProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur' // Validate when field loses focus
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/candidate/auth/create-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password: data.password
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(result.error || 'Failed to create password');
        return;
      }

      // Success - call the parent's success handler
      onSuccess();
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="password" className="block text-sm font-medium mb-2">
          {t('candidate.landing.passwordLabel')}
        </Label>
        <PasswordInput
          id="password"
          {...register('password')}
          placeholder="Enter your password"
          disabled={isSubmitting}
          autoComplete="new-password"
          className="h-11" // 44px touch target for mobile
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
        <p className="mt-1 text-sm text-gray-600">
          {t('candidate.landing.passwordHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
          {t('candidate.landing.confirmPasswordLabel')}
        </Label>
        <PasswordInput
          id="confirmPassword"
          {...register('confirmPassword')}
          placeholder="Confirm your password"
          disabled={isSubmitting}
          autoComplete="new-password"
          className="h-11" // 44px touch target for mobile
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
        )}
      </div>

      {submitError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{submitError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11" // 44px touch target for mobile
      >
        {isSubmitting ? 'Creating...' : t('candidate.landing.createPassword')}
      </Button>
    </form>
  );
}