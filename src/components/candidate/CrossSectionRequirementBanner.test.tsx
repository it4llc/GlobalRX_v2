// /GlobalRX_v2/src/components/candidate/CrossSectionRequirementBanner.test.tsx
//
// Phase 6 Stage 4 — Pass 2 component tests for CrossSectionRequirementBanner.
//
// Coverage:
//   - BR 20: banner shows the externally-triggered required field names; one
//            row per unique field even when multiple entries triggered it.
//   - DoD 15: CrossSectionRequirementBanner renders the list of externally-
//            triggered required fields on the target section.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CrossSectionRequirementBanner from './CrossSectionRequirementBanner';
import type { CrossSectionRequirementEntry } from '@/types/candidate-stage4';

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const middleNameFromEntry0: CrossSectionRequirementEntry = {
  fieldId: '11111111-1111-1111-1111-111111111111',
  fieldKey: 'middleName',
  fieldName: 'Middle Name',
  isRequired: true,
  triggeredBy: 'address_history',
  triggeredByContext: 'AU',
  triggeredByEntryIndex: 0,
};

const middleNameFromEntry1: CrossSectionRequirementEntry = {
  ...middleNameFromEntry0,
  triggeredByContext: 'BR',
  triggeredByEntryIndex: 1,
};

const motherMaidenName: CrossSectionRequirementEntry = {
  fieldId: '22222222-2222-2222-2222-222222222222',
  fieldKey: 'motherMaidenName',
  fieldName: "Mother's Maiden Name",
  isRequired: true,
  triggeredBy: 'education_history',
  triggeredByContext: 'MX',
  triggeredByEntryIndex: 0,
};

describe('CrossSectionRequirementBanner', () => {
  describe('empty state', () => {
    it('renders nothing when requirements array is empty', () => {
      const { container } = render(<CrossSectionRequirementBanner requirements={[]} />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('cross-section-banner')).not.toBeInTheDocument();
    });

    it('renders nothing when requirements is null/undefined-ish (defensive)', () => {
      const { container } = render(
        <CrossSectionRequirementBanner
          requirements={undefined as unknown as CrossSectionRequirementEntry[]}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('populated state', () => {
    it('renders the banner with one list item per unique field', () => {
      render(
        <CrossSectionRequirementBanner
          requirements={[middleNameFromEntry0, motherMaidenName]}
        />,
      );

      const banner = screen.getByTestId('cross-section-banner');
      expect(banner).toBeInTheDocument();

      const items = screen.getAllByTestId('cross-section-banner-entry');
      expect(items).toHaveLength(2);

      expect(screen.getByText('Middle Name')).toBeInTheDocument();
      expect(screen.getByText("Mother's Maiden Name")).toBeInTheDocument();
    });

    it('deduplicates by fieldKey — multiple triggers of the same field render once (BR 20)', () => {
      render(
        <CrossSectionRequirementBanner
          requirements={[
            middleNameFromEntry0,
            middleNameFromEntry1, // same fieldKey; different entry index
          ]}
        />,
      );

      const items = screen.getAllByTestId('cross-section-banner-entry');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('Middle Name');
    });

    it('renders the translated lead text', () => {
      render(
        <CrossSectionRequirementBanner requirements={[middleNameFromEntry0]} />,
      );

      // With identity translator the rendered string is the translation key.
      expect(screen.getByText('candidate.crossSection.bannerLead')).toBeInTheDocument();
    });

    it('uses an info-style banner (role="status") rather than an error', () => {
      render(
        <CrossSectionRequirementBanner requirements={[middleNameFromEntry0]} />,
      );

      const banner = screen.getByTestId('cross-section-banner');
      // Confirm it's an informational banner (role="status"), not role="alert".
      expect(banner.getAttribute('role')).toBe('status');
    });
  });
});
