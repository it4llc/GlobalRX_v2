// /GlobalRX_v2/src/components/candidate/SectionProgressIndicator.test.tsx
//
// Phase 6 Stage 4 — Pass 2 component tests for SectionProgressIndicator.
//
// Coverage:
//   - BR 14: three states only — `not_started`, `incomplete`, `complete`.
//   - BR 22: lowercase status values.
//   - DoD 10: SectionProgressIndicator renders the three lowercase statuses.
//   - Accessibility: visually-hidden label combines section name + status.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import SectionProgressIndicator from './SectionProgressIndicator';

// Translation context: identity translator. The component only uses three
// translation keys (`candidate.sectionProgress.{notStarted,incomplete,complete}`)
// for the screen-reader label; returning the key directly gives us a
// deterministic substring to assert on.
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('SectionProgressIndicator', () => {
  describe('rendering for each status', () => {
    it('renders the not_started state with grey circle and data-status="not_started"', () => {
      render(<SectionProgressIndicator status="not_started" label="Personal Information" />);

      const indicator = screen.getByTestId('section-progress-indicator');
      expect(indicator).toBeInTheDocument();
      expect(indicator.getAttribute('data-status')).toBe('not_started');

      // Grey circle (not_started visual state)
      expect(indicator.querySelector('.bg-gray-300')).not.toBeNull();
      // No green / red circles in this state
      expect(indicator.querySelector('.bg-green-500')).toBeNull();
      expect(indicator.querySelector('.bg-red-500')).toBeNull();
    });

    it('renders the incomplete state with red circle and data-status="incomplete"', () => {
      render(<SectionProgressIndicator status="incomplete" label="Education History" />);

      const indicator = screen.getByTestId('section-progress-indicator');
      expect(indicator.getAttribute('data-status')).toBe('incomplete');

      expect(indicator.querySelector('.bg-red-500')).not.toBeNull();
      expect(indicator.querySelector('.bg-green-500')).toBeNull();
    });

    it('renders the complete state with green circle and data-status="complete"', () => {
      render(<SectionProgressIndicator status="complete" label="Address History" />);

      const indicator = screen.getByTestId('section-progress-indicator');
      expect(indicator.getAttribute('data-status')).toBe('complete');

      expect(indicator.querySelector('.bg-green-500')).not.toBeNull();
      expect(indicator.querySelector('.bg-red-500')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('renders the label and translation key for the not_started status in the sr-only span', () => {
      render(<SectionProgressIndicator status="not_started" label="Personal Information" />);

      // sr-only text: "{label} — {translatedStatus}". With identity translator
      // the translated value is the key itself.
      expect(
        screen.getByText('Personal Information — candidate.sectionProgress.notStarted'),
      ).toBeInTheDocument();
    });

    it('renders the label and translation key for the incomplete status in the sr-only span', () => {
      render(<SectionProgressIndicator status="incomplete" label="IDV" />);

      expect(
        screen.getByText('IDV — candidate.sectionProgress.incomplete'),
      ).toBeInTheDocument();
    });

    it('renders the label and translation key for the complete status in the sr-only span', () => {
      render(<SectionProgressIndicator status="complete" label="Employment History" />);

      expect(
        screen.getByText('Employment History — candidate.sectionProgress.complete'),
      ).toBeInTheDocument();
    });
  });

  describe('defensive fallback for unrecognized status', () => {
    it('falls back to not_started when given an unexpected status value', () => {
      // Cast through unknown so the test can pass a value the type union forbids.
      // The defensive branch in the component is documented as unreachable in
      // normal usage but exists to handle stale-cache scenarios.
      render(
        <SectionProgressIndicator
          status={'in_progress' as unknown as 'not_started'}
          label="Stale Cache Section"
        />,
      );

      const indicator = screen.getByTestId('section-progress-indicator');
      expect(indicator.getAttribute('data-status')).toBe('not_started');
      expect(indicator.querySelector('.bg-gray-300')).not.toBeNull();
    });
  });
});
