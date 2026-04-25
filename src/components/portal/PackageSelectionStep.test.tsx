// /GlobalRX_v2/src/components/portal/PackageSelectionStep.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackageSelectionStep } from './PackageSelectionStep';
import { useTranslation } from '@/contexts/TranslationContext';
import { PackageOption } from '@/types/inviteCandidate';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn()
}));

// Mock StandardDropdown component - must render as a real dropdown for testing
vi.mock('@/components/ui/standard-dropdown', () => ({
  StandardDropdown: vi.fn(({ options, value, onChange, placeholder, disabled, id }) => (
    <select
      data-testid={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((opt: any) => (
        <option key={opt.id} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ))
}));

describe('PackageSelectionStep', () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'portal.inviteCandidate.noPackages': 'No packages available. Please contact your administrator to set up packages with workflows.',
      'portal.inviteCandidate.step1Title': 'Select Package',
      'portal.inviteCandidate.stepIndicator': 'Step {step} of 2',
      'portal.inviteCandidate.packageLabel': 'Package',
      'portal.inviteCandidate.packagePlaceholder': 'Select a package',
      'portal.inviteCandidate.nextButton': 'Next'
    };
    return translations[key] || key;
  });

  const mockPackages: PackageOption[] = [
    {
      id: 'pkg-1',
      name: 'Background Check',
      description: 'Standard background check',
      hasWorkflow: true,
      workflow: {
        name: 'Standard Workflow',
        description: 'Default workflow',
        expirationDays: 15,
        reminderEnabled: true
      }
    },
    {
      id: 'pkg-2',
      name: 'Drug Screen',
      description: 'Basic drug screening',
      hasWorkflow: true,
      workflow: {
        name: 'Quick Screen',
        description: null,
        expirationDays: 7,
        reminderEnabled: false
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTranslation).mockReturnValue({ t: mockT });
  });

  describe('rendering', () => {
    it('should render the step title and indicator', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      expect(screen.getByText('Select Package')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    });

    it('should render package dropdown with options', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const dropdown = screen.getByTestId('package-select');
      expect(dropdown).toBeInTheDocument();

      // Check that all packages are in the dropdown
      expect(screen.getByRole('option', { name: 'Background Check' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Drug Screen' })).toBeInTheDocument();
    });

    it('should show empty state when no packages available', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={[]}
          onNext={onNext}
          isLoading={false}
        />
      );

      expect(screen.getByText('No packages available. Please contact your administrator to set up packages with workflows.')).toBeInTheDocument();
      expect(screen.queryByTestId('package-select')).not.toBeInTheDocument();
    });

    it('should show required field indicator', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      expect(screen.getByText('Package')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should pre-select package when selectedPackageId is provided', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          selectedPackageId="pkg-2"
          onNext={onNext}
          isLoading={false}
        />
      );

      const dropdown = screen.getByTestId('package-select') as HTMLSelectElement;
      expect(dropdown.value).toBe('pkg-2');
    });
  });

  describe('package selection', () => {
    it('should update selection when package is chosen', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const dropdown = screen.getByTestId('package-select');
      await user.selectOptions(dropdown, 'pkg-1');

      expect((dropdown as HTMLSelectElement).value).toBe('pkg-1');
    });

    it('should show package details when selected', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const dropdown = screen.getByTestId('package-select');
      await user.selectOptions(dropdown, 'pkg-1');

      // Should show package details
      expect(screen.getByText('Selected Package:')).toBeInTheDocument();
      // Use getAllByText and check the second one (the one in the package details)
      const packageNameElements = screen.getAllByText(/Background Check/);
      expect(packageNameElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Standard background check')).toBeInTheDocument();

      // Should show workflow details
      expect(screen.getByText('Workflow: Standard Workflow')).toBeInTheDocument();
      expect(screen.getByText('Default workflow')).toBeInTheDocument();
      expect(screen.getByText('• Expires in 15 days')).toBeInTheDocument();
      expect(screen.getByText('• Automatic reminders enabled')).toBeInTheDocument();
    });

    it('should show partial workflow details when some fields are null', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const dropdown = screen.getByTestId('package-select');
      await user.selectOptions(dropdown, 'pkg-2');

      // Should show workflow name but not description (since it's null)
      expect(screen.getByText('Workflow: Quick Screen')).toBeInTheDocument();
      expect(screen.queryByText('null')).not.toBeInTheDocument();

      // Should show expiration but not reminders
      expect(screen.getByText('• Expires in 7 days')).toBeInTheDocument();
      expect(screen.queryByText('• Automatic reminders enabled')).not.toBeInTheDocument();
    });

    it('should enable Next button when package is selected', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      // Next button should be disabled initially
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Select a package - button should become enabled
      const dropdown = screen.getByTestId('package-select');
      await user.selectOptions(dropdown, 'pkg-1');

      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('validation', () => {
    it('should prevent clicking Next when no package is selected', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Trying to click a disabled button should not call onNext
      await user.click(nextButton);
      expect(onNext).not.toHaveBeenCalled();
    });

    it('should call onNext with selected package ID when valid', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const dropdown = screen.getByTestId('package-select');
      await user.selectOptions(dropdown, 'pkg-1');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(onNext).toHaveBeenCalledWith('pkg-1');
      expect(screen.queryByText('Please select a package')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should disable dropdown when loading', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={true}
        />
      );

      const dropdown = screen.getByTestId('package-select');
      expect(dropdown).toBeDisabled();
    });

    it('should disable Next button when loading', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          selectedPackageId="pkg-1"
          onNext={onNext}
          isLoading={true}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should disable Next button when no package selected', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          onNext={onNext}
          isLoading={false}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should enable Next button when package is selected and not loading', () => {
      const onNext = vi.fn();
      render(
        <PackageSelectionStep
          packages={mockPackages}
          selectedPackageId="pkg-1"
          onNext={onNext}
          isLoading={false}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });
  });
});