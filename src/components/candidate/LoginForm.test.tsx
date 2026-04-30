// /GlobalRX_v2/src/components/candidate/LoginForm.test.tsx

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'candidate.login.welcomeBack': 'Welcome back, {name}',
        'candidate.login.passwordLabel': 'Password',
        'candidate.login.passwordPlaceholder': 'Enter your password',
        'candidate.login.signIn': 'Sign In',
        'candidate.login.signingIn': 'Signing in...',
        'candidate.login.forgotPassword': 'Forgot your password?',
        'candidate.login.forgotPasswordTitle': 'Forgot Your Password?',
        'candidate.login.forgotPasswordMessage': 'Please contact the company that sent you this invitation to request a new link.',
        'candidate.login.backToLogin': 'Back to Login',
        'candidate.login.incorrectPassword': 'The password you entered is incorrect. Please try again.',
        'candidate.login.tooManyAttempts': 'Too many attempts. Please wait 15 minutes and try again.',
        'candidate.login.invitationExpired': 'This invitation has expired',
        'candidate.login.invitationCompleted': 'This invitation has already been completed',
        'candidate.login.serverError': 'Server error occurred',
        'candidate.login.genericError': 'An error occurred',
        'candidate.login.requestTimeout': 'Request timed out',
        'candidate.login.lockoutRemaining': 'Time remaining: {minutes} minutes'
      };
      return translations[key]?.replace('{name}', 'Sarah')?.replace('{minutes}', '15') || key;
    }
  }))
}));

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn()
  }))
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('LoginForm', () => {
  const mockProps = {
    token: 'test-token-123',
    firstName: 'Sarah',
    companyName: 'Test Company'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render welcome message with candidate first name', () => {
      render(<LoginForm {...mockProps} />);

      expect(screen.getByText('Welcome back, Sarah')).toBeInTheDocument();
    });

    it('should render company name', () => {
      render(<LoginForm {...mockProps} />);

      expect(screen.getByText('Test Company')).toBeInTheDocument();
    });

    it('should render password input field', () => {
      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password');
    });

    it('should render sign in button', () => {
      render(<LoginForm {...mockProps} />);

      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('should render forgot password link', () => {
      render(<LoginForm {...mockProps} />);

      expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
    });

    it('should render password visibility toggle button', () => {
      render(<LoginForm {...mockProps} />);

      const toggleButton = screen.getByRole('button', { name: 'Toggle password visibility' });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should have correct test ids for automation', () => {
      render(<LoginForm {...mockProps} />);

      expect(screen.getByTestId('candidate-login-form')).toBeInTheDocument();
    });
  });

  describe('password visibility toggle', () => {
    it('should toggle password visibility when toggle button is clicked', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: 'Toggle password visibility' });

      // Initially password type
      expect(passwordInput.type).toBe('password');

      // Click toggle to show
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      // Click toggle to hide again
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('form submission', () => {
    it('should call verify API with correct data on form submission', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          invitation: {
            id: 'test-id',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'test-token-123'
          }
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Enter password and submit
      await user.type(passwordInput, 'TestPassword123');
      await user.click(submitButton);

      expect(global.fetch).toHaveBeenCalledWith('/api/candidate/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });
    });

    it('should redirect to portal on successful login', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          invitation: {
            id: 'test-id',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'test-token-123'
          }
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'TestPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/candidate/test-token-123/portal');
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          invitation: {
            id: 'test-id',
            firstName: 'Sarah',
            status: 'accessed',
            token: 'test-token-123'
          }
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'TestPassword123');

      // Click submit and check loading state before API resolves
      user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Signing in...')).toBeInTheDocument();
      });
    });

    it('should disable form during submission', async () => {
      const user = userEvent.setup();
      // Create a promise that we can control
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(global.fetch).mockReturnValue(pendingPromise as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'TestPassword123');
      await user.click(submitButton);

      // Form should be disabled during loading
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true, invitation: { id: 'test' } })
      });

      await waitFor(() => {
        expect(passwordInput).not.toBeDisabled();
      });
    });
  });

  describe('error handling', () => {
    it('should display incorrect password error for 401 response', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Invalid credentials'
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'WrongPassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('login-error')).toHaveTextContent('The password you entered is incorrect. Please try again.');
      });
    });

    it('should clear password field after error', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Invalid credentials'
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'WrongPassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(passwordInput.value).toBe('');
      });
    });

    it('should display lockout error for 429 response', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({
          error: 'Too many attempts. Please try again later.',
          retryAfterMinutes: 15
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'WrongPassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('login-error')).toHaveTextContent('Too many attempts. Please wait 15 minutes and try again.');
      });
    });

    it('should handle specific invitation error messages', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'This invitation has expired'
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'TestPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('login-error')).toHaveTextContent('This invitation has expired');
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'TestPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('login-error')).toHaveTextContent('An error occurred');
      });
    });
  });

  describe('forgot password flow', () => {
    it('should show forgot password message when link is clicked', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...mockProps} />);

      const forgotPasswordLink = screen.getByText('Forgot your password?');
      await user.click(forgotPasswordLink);

      expect(screen.getByTestId('forgot-password-message')).toBeInTheDocument();
      expect(screen.getByText('Forgot Your Password?')).toBeInTheDocument();
      expect(screen.getByText('Please contact the company that sent you this invitation to request a new link.')).toBeInTheDocument();
    });

    it('should return to login form when back button is clicked', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...mockProps} />);

      // Click forgot password
      const forgotPasswordLink = screen.getByText('Forgot your password?');
      await user.click(forgotPasswordLink);

      // Click back to login
      const backButton = screen.getByRole('button', { name: 'Back to Login' });
      await user.click(backButton);

      expect(screen.getByTestId('candidate-login-form')).toBeInTheDocument();
      expect(screen.queryByTestId('forgot-password-message')).not.toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should disable submit button when password is empty', () => {
      render(<LoginForm {...mockProps} />);

      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when password is entered', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      expect(submitButton).toBeDisabled();

      await user.type(passwordInput, 'TestPassword123');
      expect(submitButton).not.toBeDisabled();
    });

    it('should require password field', () => {
      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      expect(passwordInput).toHaveAttribute('required');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      expect(passwordInput).toHaveAttribute('id', 'password');

      const toggleButton = screen.getByRole('button', { name: 'Toggle password visibility' });
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle password visibility');
    });

    it('should have error message with proper role', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Invalid credentials'
        })
      };
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      await user.type(passwordInput, 'WrongPassword');
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByTestId('login-error');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should auto-focus password field on render', () => {
      render(<LoginForm {...mockProps} />);

      const passwordInput = screen.getByPlaceholderText('Enter your password');
      expect(passwordInput).toHaveFocus();
    });

    it('should meet minimum touch target size requirements', () => {
      render(<LoginForm {...mockProps} />);

      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      const toggleButton = screen.getByRole('button', { name: 'Toggle password visibility' });

      // Check CSS classes for minimum height
      expect(submitButton).toHaveClass('min-h-[44px]');
      expect(toggleButton).toHaveClass('min-h-[44px]');
      expect(toggleButton).toHaveClass('min-w-[44px]');
    });
  });
});