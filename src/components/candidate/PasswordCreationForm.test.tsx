// /GlobalRX_v2/src/components/candidate/PasswordCreationForm.test.tsx

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordCreationForm } from './PasswordCreationForm';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'candidate.landing.passwordLabel': 'Password',
        'candidate.landing.confirmPasswordLabel': 'Confirm Password',
        'candidate.landing.passwordHint': 'Minimum 8 characters with at least one letter and one number',
        'candidate.landing.createPassword': 'Create Password'
      };
      return translations[key] || key;
    }
  }))
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('PasswordCreationForm', () => {
  const mockToken = 'test-token-123';
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render password and confirm password fields', () => {
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    });

    it('should render password hint text', () => {
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Minimum 8 characters with at least one letter and one number')).toBeInTheDocument();
    });

    it('should render create button', () => {
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      expect(screen.getByRole('button', { name: 'Create Password' })).toBeInTheDocument();
    });

    it('should have autocomplete set to new-password for both fields', () => {
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');

      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
      expect(confirmInput).toHaveAttribute('autocomplete', 'new-password');
    });

    it('should have 44px height for mobile touch targets', () => {
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      // The h-11 class is on the input elements themselves
      expect(passwordInput).toHaveClass('h-11');
      expect(confirmInput).toHaveClass('h-11');
      expect(submitButton).toHaveClass('h-11');
    });
  });

  describe('validation', () => {
    it('should show error when password is too short', async () => {
      const user = userEvent.setup();
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');

      await user.type(passwordInput, 'short');
      await user.type(confirmInput, 'short');
      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('should show error when password lacks a letter', async () => {
      const user = userEvent.setup();
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');

      await user.type(passwordInput, '12345678');
      await user.type(confirmInput, '12345678');
      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one letter')).toBeInTheDocument();
      });
    });

    it('should show error when password lacks a number', async () => {
      const user = userEvent.setup();
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');

      await user.type(passwordInput, 'abcdefgh');
      await user.type(confirmInput, 'abcdefgh');
      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup();
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');

      await user.type(passwordInput, 'Password123');
      await user.type(confirmInput, 'Password456');
      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should not show errors for valid matching passwords', async () => {
      const user = userEvent.setup();
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');

      await user.type(passwordInput, 'Password123');
      await user.type(confirmInput, 'Password123');
      await user.tab(); // Trigger validation

      // Wait a bit to ensure no errors appear
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(screen.queryByText(/must be at least 8 characters/)).not.toBeInTheDocument();
      expect(screen.queryByText(/must contain at least one letter/)).not.toBeInTheDocument();
      expect(screen.queryByText(/must contain at least one number/)).not.toBeInTheDocument();
      expect(screen.queryByText(/do not match/)).not.toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('should call API with correct data on valid submission', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'accessed' })
      } as Response);

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/candidate/auth/create-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: mockToken,
            password: 'ValidPass123'
          })
        });
      });
    });

    it('should call onSuccess callback after successful submission', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'accessed' })
      } as Response);

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();

      // Create a promise that we can control
      let resolveResponse: any;
      const responsePromise = new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });

      vi.mocked(fetch).mockReturnValue(responsePromise);

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument();
      });

      // Should disable button while loading
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();

      // Resolve the response
      resolveResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'accessed' })
      } as Response);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should disable input fields while submitting', async () => {
      const user = userEvent.setup();

      // Create a promise that we can control
      let resolveResponse: any;
      const responsePromise = new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });

      vi.mocked(fetch).mockReturnValue(responsePromise);

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      // Should disable inputs while submitting
      await waitFor(() => {
        expect(passwordInput).toBeDisabled();
        expect(confirmInput).toBeDisabled();
      });

      // Resolve the response
      resolveResponse({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'accessed' })
      } as Response);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error message from API response', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Password has already been created for this invitation' })
      } as Response);

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password has already been created for this invitation')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should show generic error message when API returns no error details', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({})
      } as Response);

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create password')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should show network error message when fetch fails', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should clear error message on retry', async () => {
      const user = userEvent.setup();

      // First attempt fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: 'Create Password' });

      await user.type(passwordInput, 'ValidPass123');
      await user.type(confirmInput, 'ValidPass123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument();
      });

      // Second attempt succeeds
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, status: 'accessed' })
      } as Response);

      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Network error. Please try again.')).not.toBeInTheDocument();
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('password show/hide toggle', () => {
    it('should render show/hide toggle buttons for both password fields', () => {
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      // There should be two toggle buttons (one for each password field)
      const toggleButtons = screen.getAllByRole('button', { name: /show password|hide password/i });
      expect(toggleButtons).toHaveLength(2);
    });

    it('should toggle password visibility when clicking show/hide button', async () => {
      const user = userEvent.setup();
      render(<PasswordCreationForm token={mockToken} onSuccess={mockOnSuccess} />);

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button', { name: /show password/i });

      // Initially should be password type
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click the first toggle (for main password field)
      await user.click(toggleButtons[0]);

      // Should now be text type
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click again to hide
      await user.click(toggleButtons[0]);

      // Should be back to password type
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});