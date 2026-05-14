// /GlobalRX_v2/src/components/candidate/StepNavigationButtons.test.tsx
//
// Task 8.2 (Linear Step Navigation) — Pass 2 component tests for the
// StepNavigationButtons presentational component. The component is the
// SUBJECT of the test and is therefore NOT mocked (Mocking Rule M1).
// The only mock is the TranslationContext, which is a module-level hook
// that returns a fixed shape (the project's standard mock returns the
// key as the value so we can assert against the translation key).
//
// Spec:           docs/specs/linear-step-navigation.md
// Technical plan: docs/plans/linear-step-navigation-technical-plan.md

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import StepNavigationButtons from './StepNavigationButtons';

// Mock TranslationContext — returns the key as the value so tests can assert
// on the candidate.navigation.* translation keys without depending on the
// English locale file. Matches the pattern used elsewhere in the candidate
// component tests (see section-placeholder.test.tsx, portal-layout.test.tsx).
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('StepNavigationButtons', () => {
  describe('rendering — Business Rule 2 / 4 / 13', () => {
    it('renders both Back and Next buttons when both callbacks are provided', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      expect(screen.getByTestId('step-nav-back')).toBeInTheDocument();
      expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
    });

    it('renders only the Next button when onBack is null (Business Rule 4 — first step)', () => {
      render(<StepNavigationButtons onBack={null} onNext={vi.fn()} />);

      expect(screen.queryByTestId('step-nav-back')).not.toBeInTheDocument();
      expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
    });

    it('renders only the Back button when onNext is null (Business Rule 4 — last step / Review & Submit)', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={null} />);

      expect(screen.getByTestId('step-nav-back')).toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-next')).not.toBeInTheDocument();
    });

    it('renders nothing (no container at all) when both callbacks are null (edge case 4 — single-step package)', () => {
      const { container } = render(
        <StepNavigationButtons onBack={null} onNext={null} />,
      );

      // The entire navigation container is suppressed — neither the wrapper
      // div nor either button is present in the DOM.
      expect(screen.queryByTestId('step-navigation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-back')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-next')).not.toBeInTheDocument();
      // The component returns null, so the root container has no children.
      expect(container.firstChild).toBeNull();
    });

    it('renders the navigation container with the data-testid when either button is shown', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      expect(screen.getByTestId('step-navigation')).toBeInTheDocument();
    });
  });

  describe('interaction — Business Rule 7 (delegates to caller-supplied handlers)', () => {
    it('calls onBack exactly once when the Back button is clicked', () => {
      const onBack = vi.fn();
      const onNext = vi.fn();

      render(<StepNavigationButtons onBack={onBack} onNext={onNext} />);
      fireEvent.click(screen.getByTestId('step-nav-back'));

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(onNext).not.toHaveBeenCalled();
    });

    it('calls onNext exactly once when the Next button is clicked', () => {
      const onBack = vi.fn();
      const onNext = vi.fn();

      render(<StepNavigationButtons onBack={onBack} onNext={onNext} />);
      fireEvent.click(screen.getByTestId('step-nav-next'));

      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
    });
  });

  describe('translation keys — Business Rule 13 / DoD 12', () => {
    it('Back button uses the candidate.navigation.back translation key as its label', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const backButton = screen.getByTestId('step-nav-back');
      // The translation mock returns the key as the value, so the rendered
      // text equals the key. This verifies the source file passes the
      // correct key to `t()`.
      expect(backButton).toHaveTextContent('candidate.navigation.back');
    });

    it('Next button uses the candidate.navigation.next translation key as its label', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const nextButton = screen.getByTestId('step-nav-next');
      expect(nextButton).toHaveTextContent('candidate.navigation.next');
    });
  });

  describe('styling — Business Rule 3 / 12 / DoD 3 / DoD 10 / DoD 11', () => {
    it('Back button has min-h-[44px] for mobile tap targets (Business Rule 12 / DoD 10)', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const backButton = screen.getByTestId('step-nav-back');
      expect(backButton).toHaveClass('min-h-[44px]');
    });

    it('Next button has min-h-[44px] for mobile tap targets (Business Rule 12 / DoD 10)', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const nextButton = screen.getByTestId('step-nav-next');
      expect(nextButton).toHaveClass('min-h-[44px]');
    });

    it('Back button has w-full sm:w-auto for full-width-on-mobile behavior (DoD 11 / edge case 7)', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const backButton = screen.getByTestId('step-nav-back');
      expect(backButton).toHaveClass('w-full');
      expect(backButton).toHaveClass('sm:w-auto');
    });

    it('Next button has w-full sm:w-auto for full-width-on-mobile behavior (DoD 11 / edge case 7)', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const nextButton = screen.getByTestId('step-nav-next');
      expect(nextButton).toHaveClass('w-full');
      expect(nextButton).toHaveClass('sm:w-auto');
    });

    it('Back button uses the secondary/outline palette (white background + gray border) per Business Rule 3', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const backButton = screen.getByTestId('step-nav-back');
      // Outline pattern: bg-white + border + border-gray-300 + gray text.
      expect(backButton).toHaveClass('bg-white');
      expect(backButton).toHaveClass('border');
      expect(backButton).toHaveClass('border-gray-300');
      expect(backButton).toHaveClass('text-gray-700');
    });

    it('Next button uses the primary/filled palette (blue background + white text) per Business Rule 3', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const nextButton = screen.getByTestId('step-nav-next');
      // Filled-primary pattern matching the existing Submit-button palette.
      expect(nextButton).toHaveClass('bg-blue-600');
      expect(nextButton).toHaveClass('text-white');
    });

    it('the navigation container is stacked on mobile (flex-col-reverse) and side-by-side on sm+ (sm:flex-row)', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const container = screen.getByTestId('step-navigation');
      // flex-col-reverse on mobile puts Next on top when stacked; sm:flex-row
      // switches to a horizontal row above 640px so Back ends up on the left.
      expect(container).toHaveClass('flex-col-reverse');
      expect(container).toHaveClass('sm:flex-row');
      expect(container).toHaveClass('sm:justify-between');
    });
  });

  describe('button semantics', () => {
    it('Back button has type="button" so it does not accidentally submit forms', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const backButton = screen.getByTestId('step-nav-back');
      expect(backButton).toHaveAttribute('type', 'button');
    });

    it('Next button has type="button" so it does not accidentally submit forms', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const nextButton = screen.getByTestId('step-nav-next');
      expect(nextButton).toHaveAttribute('type', 'button');
    });
  });

  describe('nextDisabled prop (forward-compatible toggle)', () => {
    it('Next button is enabled by default', () => {
      render(<StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} />);

      const nextButton = screen.getByTestId('step-nav-next') as HTMLButtonElement;
      expect(nextButton.disabled).toBe(false);
    });

    it('Next button is disabled and aria-disabled when nextDisabled is true', () => {
      render(
        <StepNavigationButtons onBack={vi.fn()} onNext={vi.fn()} nextDisabled />,
      );

      const nextButton = screen.getByTestId('step-nav-next') as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
      expect(nextButton.getAttribute('aria-disabled')).toBe('true');
    });

    it('clicking a disabled Next button does NOT invoke onNext', () => {
      const onNext = vi.fn();
      render(
        <StepNavigationButtons onBack={vi.fn()} onNext={onNext} nextDisabled />,
      );

      const nextButton = screen.getByTestId('step-nav-next');
      fireEvent.click(nextButton);

      expect(onNext).not.toHaveBeenCalled();
    });
  });
});
