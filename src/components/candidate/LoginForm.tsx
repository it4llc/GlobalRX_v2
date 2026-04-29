// /GlobalRX_v2/src/components/candidate/LoginForm.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';

interface LoginFormProps {
  token: string;
  firstName: string;
  companyName: string;
}

export function LoginForm({ token, firstName, companyName }: LoginFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/candidate/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success - redirect to portal
        router.push(`/candidate/${token}/portal`);
      } else if (response.status === 429) {
        // Rate limited
        setError(t('candidate.login.tooManyAttempts'));
        setLockoutMinutes(data.retryAfterMinutes || 15);
        setPassword('');
      } else if (response.status === 401) {
        // Wrong password or other auth error
        if (data.error === 'This invitation has expired') {
          setError(t('candidate.login.invitationExpired'));
        } else if (data.error === 'This invitation has already been completed') {
          setError(t('candidate.login.invitationCompleted'));
        } else {
          setError(t('candidate.login.incorrectPassword'));
        }
        setPassword('');
      } else if (response.status === 500) {
        setError(t('candidate.login.serverError'));
      } else {
        setError(t('candidate.login.genericError'));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError(t('candidate.login.requestTimeout'));
      } else {
        setError(t('candidate.login.genericError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="card-container" data-testid="forgot-password-message">
        <h2 className="form-header">{t('candidate.login.forgotPasswordTitle')}</h2>
        <p className="text-gray-600 mb-6">
          {t('candidate.login.forgotPasswordMessage')}
        </p>
        <button
          onClick={() => setShowForgotPassword(false)}
          className="btn-primary w-full"
        >
          {t('candidate.login.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div className="card-container" data-testid="candidate-login-form">
      <h1 className="form-header">
        {t('candidate.login.welcomeBack', { name: firstName })}
      </h1>
      <p className="text-gray-600 mb-6">{companyName}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="sr-only">
            {t('candidate.login.passwordLabel')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('candidate.login.passwordPlaceholder')}
              className="input-field pr-12"
              disabled={isLoading || lockoutMinutes > 0}
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="error-message text-sm"
            data-testid="login-error"
            role="alert"
          >
            {error}
            {lockoutMinutes > 0 && (
              <span className="block mt-1">
                {t('candidate.login.lockoutRemaining', { minutes: lockoutMinutes })}
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full min-h-[44px]"
          disabled={isLoading || lockoutMinutes > 0 || !password}
        >
          {isLoading ? t('candidate.login.signingIn') : t('candidate.login.signIn')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowForgotPassword(true);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {t('candidate.login.forgotPassword')}
        </a>
      </div>
    </div>
  );
}