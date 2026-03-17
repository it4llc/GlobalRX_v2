// Test to verify the fix for undefined finalText.length error
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentCreateModal } from '../CommentCreateModal';

// Mock the translation hook
vi.mock('@/utils/i18n/client', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('CommentCreateModal - FIX VERIFICATION', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onCreate: mockOnCreate,
    serviceId: 'test-service-id',
    orderItemId: 'test-order-item-id',
  };

  // This test verifies the fix works - should PASS after the fix
  it('should handle undefined templateText gracefully without crashing', () => {
    const templatesWithUndefined = [
      {
        id: '1',
        templateText: undefined as any, // This would cause finalText to be undefined before fix
        isActive: true,
      }
    ];

    // After the fix, this should NOT throw an error
    const { container } = render(
      <CommentCreateModal
        {...defaultProps}
        templates={templatesWithUndefined}
      />
    );

    // Component should render without crashing
    expect(container).toBeTruthy();

    // The modal should be open with the select dropdown
    expect(screen.getByText('Select a template...')).toBeTruthy();
  });

  it('should handle null templateText gracefully', () => {
    const templatesWithNull = [
      {
        id: '1',
        templateText: null as any,
        isActive: true,
      }
    ];

    // Should not crash
    const { container } = render(
      <CommentCreateModal
        {...defaultProps}
        templates={templatesWithNull}
      />
    );

    expect(container).toBeTruthy();
    expect(screen.getByText('Select a template...')).toBeTruthy();
  });

  it('should handle empty string templateText correctly', () => {
    const templatesWithEmpty = [
      {
        id: '1',
        templateText: '',
        isActive: true,
      }
    ];

    const { container } = render(
      <CommentCreateModal
        {...defaultProps}
        templates={templatesWithEmpty}
      />
    );

    expect(container).toBeTruthy();
    expect(screen.getByText('Select a template...')).toBeTruthy();
  });

  it('should handle normal templateText correctly', () => {
    const normalTemplates = [
      {
        id: '1',
        templateText: 'This is a test template',
        isActive: true,
      }
    ];

    const { container } = render(
      <CommentCreateModal
        {...defaultProps}
        templates={normalTemplates}
      />
    );

    expect(container).toBeTruthy();
    // Modal should be open with template selector
    expect(screen.getByText('Select a template...')).toBeTruthy();
  });
});