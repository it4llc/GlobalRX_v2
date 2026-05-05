// /GlobalRX_v2/src/components/candidate/CrossSectionRequirementBanner.tsx
//
// Phase 6 Stage 4 — informational banner shown at the top of a target
// section when one or more cross-section registry entries point to it. Lists
// the externally-triggered required field names. Hidden when the
// requirements array is empty.
//
// The banner uses info/blue styling per the spec (BR 20) — it is NOT an
// error. The candidate may navigate to the relevant fields via the section's
// existing field grid; the banner exists only to explain why those fields
// are now required.
//
// Stateless presentational component. No API calls.

'use client';

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CrossSectionRequirementEntry } from '@/types/candidate-stage4';

interface CrossSectionRequirementBannerProps {
  requirements: CrossSectionRequirementEntry[];
}

export default function CrossSectionRequirementBanner({
  requirements,
}: CrossSectionRequirementBannerProps) {
  const { t } = useTranslation();

  if (!requirements || requirements.length === 0) {
    return null;
  }

  // Deduplicate by fieldKey for display (BR 20 — banner shows each unique
  // field name only once even if multiple entries triggered it). The
  // registry intentionally holds separate rows per (fieldId, triggeredBy,
  // triggeredByEntryIndex) so we don't lose the relationship between a
  // requirement and the specific entry that contributed it; the banner just
  // collapses for readability.
  const uniqueByKey = new Map<string, CrossSectionRequirementEntry>();
  for (const entry of requirements) {
    if (!uniqueByKey.has(entry.fieldKey)) {
      uniqueByKey.set(entry.fieldKey, entry);
    }
  }
  const displayed = Array.from(uniqueByKey.values());

  return (
    <div
      className="rounded-md bg-blue-50 border border-blue-200 p-4 mb-4 text-sm text-blue-900"
      role="status"
      data-testid="cross-section-banner"
    >
      <p className="font-medium">{t('candidate.crossSection.bannerLead')}</p>
      <ul className="mt-2 list-disc list-inside">
        {displayed.map((entry) => (
          <li key={entry.fieldKey} data-testid="cross-section-banner-entry">
            {entry.fieldName}
          </li>
        ))}
      </ul>
    </div>
  );
}
