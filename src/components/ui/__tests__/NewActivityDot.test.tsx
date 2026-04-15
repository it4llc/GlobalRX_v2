// /GlobalRX_v2/src/components/ui/__tests__/NewActivityDot.test.tsx

/**
 * SOURCE FILES READ LOG
 *
 * Files read before writing this test:
 * - docs/CODING_STANDARDS.md (lines 1-940) - Core development rules
 * - docs/TESTING_STANDARDS.md (lines 1-276) - Testing patterns and TDD workflow
 * - docs/COMPONENT_STANDARDS.md (lines 1-276) - Component and styling standards
 * - docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md (lines 1-372) - Feature specification
 * - docs/architecture/order-view-tracking-phase-2d-technical-plan.md (lines 1-510) - Technical implementation plan
 * - src/components/ui/NewActivityDot.tsx (lines 1-47) - The component under test
 * - src/components/ui/checkbox.tsx (lines 1-66) - Existing UI component for pattern reference
 * - src/components/ui/checkbox.test.tsx (lines 1-256) - Existing test file for pattern matching
 * - src/lib/utils.ts (lines 1-25) - cn() helper utility
 * - src/test/setup.ts (lines 1-239) - Test environment configuration
 * - vitest.config.mjs (lines 1-62) - Vitest configuration
 */

/**
 * PATTERN MATCH BLOCK
 *
 * Test file I am creating: src/components/ui/__tests__/NewActivityDot.test.tsx
 *
 * Existing tests I read for reference:
 * 1. src/components/ui/checkbox.test.tsx
 *
 * Patterns I am copying from the existing test:
 * - Import style for component: import { Checkbox } from './checkbox' (relative path from __tests__ to parent)
 * - NO vi.mock() for the component under test - the real component is imported directly
 * - Import React explicitly: import React from 'react'
 * - Use describe/it blocks for organization
 * - Use render, screen from @testing-library/react
 * - Test rendering behavior, prop handling, className merging
 * - NO mocking of cn() utility - the real helper is used
 *
 * I will NOT do any of the following:
 * - Mock NewActivityDot component
 * - Mock cn() from @/lib/utils
 * - Mock React
 * - Create stub tests with throw statements
 * - Test behavior outside the component's contract
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewActivityDot } from '../NewActivityDot';

describe('NewActivityDot', () => {
  describe('visibility control', () => {
    it('renders nothing when show is false', () => {
      const { container } = render(
        <NewActivityDot
          show={false}
          aria-label="Test indicator"
        />
      );

      // Container should have no children when component returns null
      expect(container.firstChild).toBeNull();
    });

    it('renders a visible element when show is true', () => {
      render(
        <NewActivityDot
          show={true}
          aria-label="Test indicator"
        />
      );

      // Verify exactly one element with role="status" is rendered
      const indicators = screen.getAllByRole('status');
      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toBeInTheDocument();
    });
  });

  describe('accessibility attributes', () => {
    it('applies the provided aria-label correctly', () => {
      const testLabel = 'Order has new activity';
      render(
        <NewActivityDot
          show={true}
          aria-label={testLabel}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', testLabel);
    });

    it('has role="status" attribute when rendered', () => {
      render(
        <NewActivityDot
          show={true}
          aria-label="Test indicator"
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('role', 'status');
    });
  });

  describe('styling', () => {
    it('applies base Tailwind classes when no className prop is provided', () => {
      render(
        <NewActivityDot
          show={true}
          aria-label="Test indicator"
        />
      );

      const indicator = screen.getByRole('status');
      const className = indicator.className;

      // Verify all base classes are present
      expect(className).toContain('inline-block');
      expect(className).toContain('w-2');
      expect(className).toContain('h-2');
      expect(className).toContain('bg-red-500');
      expect(className).toContain('rounded-full');
    });

    it('merges custom className with base classes', () => {
      const customClass = 'ml-2';
      render(
        <NewActivityDot
          show={true}
          aria-label="Test indicator"
          className={customClass}
        />
      );

      const indicator = screen.getByRole('status');
      const className = indicator.className;

      // Verify both base and custom classes are present
      expect(className).toContain('inline-block');
      expect(className).toContain('w-2');
      expect(className).toContain('h-2');
      expect(className).toContain('bg-red-500');
      expect(className).toContain('rounded-full');
      expect(className).toContain('ml-2');
    });

    it('renders just the base classes when className prop is undefined', () => {
      render(
        <NewActivityDot
          show={true}
          aria-label="Test indicator"
          className={undefined}
        />
      );

      const indicator = screen.getByRole('status');
      const className = indicator.className;

      // Should only contain base classes
      expect(className).toContain('inline-block');
      expect(className).toContain('w-2');
      expect(className).toContain('h-2');
      expect(className).toContain('bg-red-500');
      expect(className).toContain('rounded-full');
    });

    it('renders correctly with different aria-label values', () => {
      // First render with one aria-label
      const { rerender } = render(
        <NewActivityDot
          show={true}
          aria-label="Service has new activity"
        />
      );

      let indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Service has new activity');

      // Re-render with different aria-label
      rerender(
        <NewActivityDot
          show={true}
          aria-label="Order has updates"
        />
      );

      indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Order has updates');
    });
  });
});