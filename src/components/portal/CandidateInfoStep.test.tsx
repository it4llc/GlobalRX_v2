// /GlobalRX_v2/src/components/portal/CandidateInfoStep.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CandidateInfoStep } from './CandidateInfoStep';
import { useTranslation } from '@/contexts/TranslationContext';
import { InviteFormData } from '@/types/inviteCandidate';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn()
}));

// Mock Zod validation
vi.mock('@/lib/validations/candidateInvitation', () => ({
  createInvitationSchema: {
    safeParse: vi.fn()
  }
}));

describe('CandidateInfoStep', () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'portal.inviteCandidate.step2Title': 'Candidate Information',
      'portal.inviteCandidate.stepIndicator': 'Step {step} of 2',
      'portal.inviteCandidate.firstNameLabel': 'First Name',
      'portal.inviteCandidate.lastNameLabel': 'Last Name',
      'portal.inviteCandidate.emailLabel': 'Email Address',
      'portal.inviteCandidate.phoneCountryCodeLabel': 'Phone Country Code',
      'portal.inviteCandidate.phoneNumberLabel': 'Phone Number',
      'portal.inviteCandidate.createButton': 'Create Invitation',
      'portal.inviteCandidate.emailValidation': 'Please enter a valid email address'
    };
    return translations[key] || key;
  });

  const mockOnBack = vi.fn();
  const mockOnSubmit = vi.fn();

  const defaultProps = {
    formData: { packageId: 'pkg-1' },
    onBack: mockOnBack,
    onSubmit: mockOnSubmit,
    isSubmitting: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTranslation).mockReturnValue({ t: mockT });
  });

  describe('rendering', () => {
    it('should render the step title and indicator', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      expect(screen.getByText('Candidate Information')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      expect(screen.getByTestId('firstName')).toBeInTheDocument();
      expect(screen.getByTestId('lastName')).toBeInTheDocument();
      expect(screen.getByTestId('email')).toBeInTheDocument();
      expect(screen.getByTestId('phoneCountryCode')).toBeInTheDocument();
      expect(screen.getByTestId('phoneNumber')).toBeInTheDocument();
    });

    it('should show required indicators for required fields', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      // Check for required fields (First Name, Last Name, Email)
      const firstNameInput = screen.getByTestId('firstName');
      const lastNameInput = screen.getByTestId('lastName');
      const emailInput = screen.getByTestId('email');

      expect(firstNameInput).toHaveAttribute('required');
      expect(lastNameInput).toHaveAttribute('required');
      expect(emailInput).toHaveAttribute('required');
    });

    it('should render Back and Create buttons', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create invitation/i })).toBeInTheDocument();
    });

    it('should pre-populate fields with initial form data', () => {
      const formData = {
        packageId: 'pkg-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneCountryCode: '+44',
        phoneNumber: '1234567890'
      };

      render(<CandidateInfoStep {...defaultProps} formData={formData} />);

      expect(screen.getByTestId('firstName')).toHaveValue('John');
      expect(screen.getByTestId('lastName')).toHaveValue('Doe');
      expect(screen.getByTestId('email')).toHaveValue('john.doe@example.com');
      expect(screen.getByTestId('phoneCountryCode')).toHaveValue('+44');
      expect(screen.getByTestId('phoneNumber')).toHaveValue('1234567890');
    });

    it('should default phone country code to +1 when not provided', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      expect(screen.getByTestId('phoneCountryCode')).toHaveValue('+1');
    });
  });

  describe('user input', () => {
    it('should update field values when user types', async () => {
      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const firstNameInput = screen.getByTestId('firstName');
      const lastNameInput = screen.getByTestId('lastName');
      const emailInput = screen.getByTestId('email');

      await user.type(firstNameInput, 'Jane');
      await user.type(lastNameInput, 'Smith');
      await user.type(emailInput, 'jane.smith@example.com');

      expect(firstNameInput).toHaveValue('Jane');
      expect(lastNameInput).toHaveValue('Smith');
      expect(emailInput).toHaveValue('jane.smith@example.com');
    });

    it('should handle phone country code selection', async () => {
      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const countryCodeSelect = screen.getByTestId('phoneCountryCode');
      await user.selectOptions(countryCodeSelect, '+44');

      expect(countryCodeSelect).toHaveValue('+44');
    });

    it('should show available country code options', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      const countryCodeSelect = screen.getByTestId('phoneCountryCode');
      const options = countryCodeSelect.querySelectorAll('option');

      // Should have multiple country codes
      expect(options.length).toBeGreaterThan(5);
      expect(screen.getByText('+1 (US/CA)')).toBeInTheDocument();
      expect(screen.getByText('+44 (UK)')).toBeInTheDocument();
      expect(screen.getByText('+86 (CN)')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should validate email format on blur', async () => {
      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const emailInput = screen.getByTestId('email');

      // Type invalid email and blur
      await user.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should clear error when user corrects email', async () => {
      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const emailInput = screen.getByTestId('email');

      // Type invalid email and blur
      await user.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      // Clear and type valid email
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');

      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });

    it('should show validation errors when submitting with missing fields', async () => {
      const { createInvitationSchema } = await import('@/lib/validations/candidateInvitation');
      vi.mocked(createInvitationSchema.safeParse).mockReturnValue({
        success: false,
        error: {
          errors: [
            { path: ['firstName'], message: 'First name is required' },
            { path: ['lastName'], message: 'Last name is required' },
            { path: ['email'], message: 'Email is required' }
          ]
        }
      });

      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const createButton = screen.getByRole('button', { name: /create invitation/i });
      await user.click(createButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should submit form when all required fields are valid', async () => {
      const validData: InviteFormData = {
        packageId: 'pkg-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneCountryCode: '+1',
        phoneNumber: ''
      };

      const { createInvitationSchema } = await import('@/lib/validations/candidateInvitation');
      vi.mocked(createInvitationSchema.safeParse).mockReturnValue({
        success: true,
        data: validData
      });

      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const firstNameInput = screen.getByTestId('firstName');
      const lastNameInput = screen.getByTestId('lastName');
      const emailInput = screen.getByTestId('email');

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(emailInput, 'john.doe@example.com');

      const createButton = screen.getByRole('button', { name: /create invitation/i });
      await user.click(createButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(validData);
    });

    it('should include phone number when provided', async () => {
      const validData: InviteFormData = {
        packageId: 'pkg-1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneCountryCode: '+44',
        phoneNumber: '7700900123'
      };

      const { createInvitationSchema } = await import('@/lib/validations/candidateInvitation');
      vi.mocked(createInvitationSchema.safeParse).mockReturnValue({
        success: true,
        data: validData
      });

      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      await user.type(screen.getByTestId('firstName'), 'Jane');
      await user.type(screen.getByTestId('lastName'), 'Smith');
      await user.type(screen.getByTestId('email'), 'jane@example.com');
      await user.selectOptions(screen.getByTestId('phoneCountryCode'), '+44');
      await user.type(screen.getByTestId('phoneNumber'), '7700900123');

      const createButton = screen.getByRole('button', { name: /create invitation/i });
      await user.click(createButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(validData);
    });
  });

  describe('navigation', () => {
    it('should call onBack when Back button is clicked', async () => {
      const user = userEvent.setup();
      render(<CandidateInfoStep {...defaultProps} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should disable all inputs when submitting', () => {
      render(<CandidateInfoStep {...defaultProps} isSubmitting={true} />);

      expect(screen.getByTestId('firstName')).toBeDisabled();
      expect(screen.getByTestId('lastName')).toBeDisabled();
      expect(screen.getByTestId('email')).toBeDisabled();
      expect(screen.getByTestId('phoneCountryCode')).toBeDisabled();
      expect(screen.getByTestId('phoneNumber')).toBeDisabled();
    });

    it('should disable buttons when submitting', () => {
      render(<CandidateInfoStep {...defaultProps} isSubmitting={true} />);

      expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });

    it('should show "Creating..." text when submitting', () => {
      render(<CandidateInfoStep {...defaultProps} isSubmitting={true} />);

      expect(screen.getByRole('button', { name: /creating/i })).toHaveTextContent('Creating...');
    });
  });

  describe('field constraints', () => {
    it('should enforce max length on text fields', () => {
      render(<CandidateInfoStep {...defaultProps} />);

      expect(screen.getByTestId('firstName')).toHaveAttribute('maxLength', '100');
      expect(screen.getByTestId('lastName')).toHaveAttribute('maxLength', '100');
      expect(screen.getByTestId('email')).toHaveAttribute('maxLength', '254');
      expect(screen.getByTestId('phoneNumber')).toHaveAttribute('maxLength', '20');
    });
  });
});