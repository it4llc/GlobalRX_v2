// /GlobalRX_v2/src/components/portal/order-details/InvitationActionButton.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvitationActionButton } from './InvitationActionButton';
import { InvitationAction } from '@/types/invitation-management';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  })
}));

describe('InvitationActionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('rendering', () => {
    it('should render extend button with correct label and icon', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('invitation.action.extend');

      // Check for clock icon
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render resend button with correct label and icon', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.RESEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('resend-invitation-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('invitation.action.resend');

      // Check for envelope icon
      const icon = button.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should apply correct styling when not disabled', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
          disabled={false}
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      expect(button).toHaveClass('bg-blue-600', 'text-white', 'hover:bg-blue-700');
      expect(button).not.toHaveClass('bg-gray-100', 'text-gray-400');
    });

    it('should apply disabled styling when disabled', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
          disabled={true}
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      expect(button).toHaveClass('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
      expect(button).not.toHaveClass('bg-blue-600', 'text-white');
    });
  });

  describe('onClick handler', () => {
    it('should call API endpoint when clicked', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/candidate/invitations/inv-123/extend',
          { method: 'POST' }
        );
      });
    });

    it('should call onSuccess callback when API call succeeds', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      vi.stubGlobal('fetch', mockFetch);

      const onSuccess = vi.fn();

      render(
        <InvitationActionButton
          action={InvitationAction.RESEND}
          invitationId="inv-456"
          onSuccess={onSuccess}
        />
      );

      const button = screen.getByTestId('resend-invitation-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/candidate/invitations/inv-456/resend',
          { method: 'POST' }
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should not call onSuccess when API call fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Permission denied' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const onSuccess = vi.fn();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
          onSuccess={onSuccess}
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(
          'Error extending invitation:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('should not make API call when disabled', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
          disabled={true}
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      fireEvent.click(button);

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading text for extend action', async () => {
      // Create a promise we can control
      let resolvePromise: (value: any) => void;
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('extend-invitation-button');

      // Initially shows normal text
      expect(button).toHaveTextContent('invitation.action.extend');

      // Click to trigger loading
      fireEvent.click(button);

      // Should show loading text
      await waitFor(() => {
        expect(button).toHaveTextContent('invitation.action.extending');
      });

      // Icon should have animate-spin class
      const icon = button.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true })
      });

      // Should return to normal text
      await waitFor(() => {
        expect(button).toHaveTextContent('invitation.action.extend');
      });
    });

    it('should show loading text for resend action', async () => {
      // Create a promise we can control
      let resolvePromise: (value: any) => void;
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationActionButton
          action={InvitationAction.RESEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('resend-invitation-button');

      // Initially shows normal text
      expect(button).toHaveTextContent('invitation.action.resend');

      // Click to trigger loading
      fireEvent.click(button);

      // Should show loading text
      await waitFor(() => {
        expect(button).toHaveTextContent('invitation.action.resending');
      });

      // Icon should have animate-spin class
      const icon = button.querySelector('svg');
      expect(icon).toHaveClass('animate-spin');

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true })
      });

      // Should return to normal text
      await waitFor(() => {
        expect(button).toHaveTextContent('invitation.action.resend');
      });
    });

    it('should disable button while loading', async () => {
      // Create a promise we can control
      let resolvePromise: (value: any) => void;
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('extend-invitation-button');

      // Initially not disabled
      expect(button).not.toBeDisabled();

      // Click to trigger loading
      fireEvent.click(button);

      // Should be disabled during loading
      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Should have disabled styling
      expect(button).toHaveClass('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true })
      });

      // Should be enabled again
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should prevent multiple simultaneous API calls', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 100))
      );
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('extend-invitation-button');

      // Click multiple times quickly
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Should only make one API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
          disabled={true}
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      expect(button).toBeDisabled();
    });

    it('should not be disabled when disabled prop is false', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
          disabled={false}
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      expect(button).not.toBeDisabled();
    });

    it('should not be disabled when disabled prop is not provided', () => {
      render(
        <InvitationActionButton
          action={InvitationAction.EXTEND}
          invitationId="inv-123"
        />
      );

      const button = screen.getByTestId('extend-invitation-button');
      expect(button).not.toBeDisabled();
    });
  });
});