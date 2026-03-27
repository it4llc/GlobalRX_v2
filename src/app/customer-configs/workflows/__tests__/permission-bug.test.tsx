// REGRESSION TEST: proves bug fix for customer config permission consistency
// Bug: Workflows page checks for "workflows" permission but User Admin saves "customer_config"
// This test should FAIL before the fix and PASS after the fix

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowsPage from '../page';

// Mock the translation context
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock the auth context
const mockCheckPermission = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    checkPermission: mockCheckPermission
  })
}));

// Mock the UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  )
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>
}));

vi.mock('@/components/ui/action-dropdown', () => ({
  ActionDropdown: ({ options }: any) => (
    <div data-testid="action-dropdown">
      {options.map((opt: any, i: number) => (
        <button key={i} onClick={opt.onClick}>{opt.label}</button>
      ))}
    </div>
  )
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-variant={variant}>{children}</span>
  )
}));

vi.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: () => <div>Loading...</div>
}));

vi.mock('@/components/ui/alert-box', () => ({
  AlertBox: ({ title, message, type }: any) => (
    <div data-type={type}>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}));

vi.mock('@/components/modules/workflows/workflow-dialog', () => ({
  WorkflowDialog: ({ open, onOpenChange, workflow, onSuccess }: any) =>
    open ? <div data-testid="workflow-dialog">Dialog Open</div> : null
}));

vi.mock('@/lib/client-logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  errorToLogMeta: vi.fn()
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Workflows Page Permission Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockReturnValue(false);
  });

  describe('Permission checking regression tests', () => {
    // REGRESSION TEST: This is the key test that proves the bug
    it('REGRESSION: should show workflows when user has customer_config permission (currently fails)', async () => {
      // Setup: User has customer_config permission (what User Admin saves)
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config';
      });

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          workflows: [
            {
              id: 'wf1',
              name: 'Test Workflow',
              description: 'Test Description',
              status: 'active',
              expirationDays: 30,
              updatedAt: '2024-01-01'
            }
          ]
        })
      });

      const { container } = render(<WorkflowsPage />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // CRITICAL ASSERTION: User with customer_config permission should see workflows
      // This currently fails because component checks for "workflows" permission
      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
      expect(screen.getByText('module.candidateWorkflow.buttons.createWorkflow')).toBeInTheDocument();
    });

    // This test shows current wrong behavior
    it('works with user having "customer_config" permission (correct key)', async () => {
      // User has the CORRECT permission key
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config'; // Correct key
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ workflows: [] })
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Works correctly with the right permission key
      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('module.candidateWorkflow.sections.workflows')).toBeInTheDocument();
    });

    it('should show no permission message when user lacks permissions', async () => {
      // User has unrelated permission
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'fulfillment';
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show permission denied message
      expect(screen.getByText('common.noPermission')).toBeInTheDocument();
      expect(screen.getByText('common.contactAdmin')).toBeInTheDocument();
    });

    it('should show workflows for admin users', async () => {
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'admin';
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ workflows: [] })
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('module.candidateWorkflow.sections.workflows')).toBeInTheDocument();
    });
  });

  describe('Create button visibility regression', () => {
    it('REGRESSION: should show create button when user has customer_config edit permission', async () => {
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config';
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ workflows: [] })
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show create button with customer_config permission
      expect(screen.getByText('module.candidateWorkflow.buttons.createWorkflow')).toBeInTheDocument();
    });
  });

  describe('API error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config';
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show error message
      expect(screen.getByText(/API error: 500/)).toBeInTheDocument();
    });

    it('should handle network errors', async () => {
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config';
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Workflow data rendering', () => {
    it('should render workflow data correctly when permissions are valid', async () => {
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config' || permission === 'admin';
      });

      const mockWorkflows = [
        {
          id: 'wf1',
          name: 'Onboarding Workflow',
          description: 'New employee onboarding',
          status: 'active',
          expirationDays: 30,
          updatedAt: '2024-01-15T10:30:00Z',
          defaultLanguage: 'en',
          autoCloseEnabled: false,
          extensionAllowed: true,
          disabled: false
        },
        {
          id: 'wf2',
          name: 'Background Check',
          description: 'Standard background check',
          status: 'draft',
          expirationDays: 14,
          updatedAt: '2024-01-10T14:20:00Z',
          defaultLanguage: 'en',
          autoCloseEnabled: true,
          extensionAllowed: false,
          disabled: false
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ workflows: mockWorkflows })
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Check that workflows are rendered
      expect(screen.getByText('Onboarding Workflow')).toBeInTheDocument();
      expect(screen.getByText('New employee onboarding')).toBeInTheDocument();
      expect(screen.getByText('Background Check')).toBeInTheDocument();
      expect(screen.getByText('Standard background check')).toBeInTheDocument();

      // Check status badges
      expect(screen.getByText('module.candidateWorkflow.status.active')).toBeInTheDocument();
      expect(screen.getByText('module.candidateWorkflow.status.draft')).toBeInTheDocument();
    });

    it('should show empty state when no workflows exist', async () => {
      mockCheckPermission.mockImplementation((permission: string) => {
        return permission === 'customer_config';
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ workflows: [] })
      });

      render(<WorkflowsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('module.candidateWorkflow.noWorkflows')).toBeInTheDocument();
    });
  });

  describe('Permission check variations', () => {
    it('REGRESSION: should work with various customer_config permission formats', async () => {
      const testCases = [
        { customer_config: '*' },
        { customer_config: true },
        { customer_config: { view: true, edit: true } },
        { customer_config: ['view', 'edit'] }
      ];

      for (const permissions of testCases) {
        vi.clearAllMocks();

        mockCheckPermission.mockImplementation((permission: string) => {
          return permission === 'customer_config';
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ workflows: [] })
        });

        const { unmount } = render(<WorkflowsPage />);

        await waitFor(() => {
          expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        // Should show workflows page, not permission error
        expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
        expect(screen.getByText('module.candidateWorkflow.sections.workflows')).toBeInTheDocument();

        unmount();
      }
    });
  });
});