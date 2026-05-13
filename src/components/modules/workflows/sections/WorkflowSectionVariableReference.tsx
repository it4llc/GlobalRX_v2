// /GlobalRX_v2/src/components/modules/workflows/sections/WorkflowSectionVariableReference.tsx

/**
 * Admin-facing reference panel for the template variables that the
 * workflow-section content editor supports. Reads its entries from the
 * shared registry so adding a future variable surfaces here automatically
 * without touching this component.
 *
 * The panel is read-only in v1 (spec Resolved Question #2). A future
 * enhancement could turn each `{{name}}` chip into a click-to-insert
 * action; that is intentionally out of scope.
 */

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';

import { TEMPLATE_VARIABLE_REGISTRY } from '@/lib/templates/variableRegistry';

export default function WorkflowSectionVariableReference() {
  const { t } = useTranslation();

  return (
    <div
      className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3"
      data-testid="workflow-section-variable-reference"
    >
      <h4 className="text-sm font-semibold text-gray-900">
        {t('admin.workflowSection.variable.heading')}
      </h4>
      <p className="mt-1 text-xs text-gray-600">
        {t('admin.workflowSection.variable.intro')}
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        {TEMPLATE_VARIABLE_REGISTRY.map((entry) => (
          <React.Fragment key={entry.name}>
            <dt className="font-mono text-xs text-gray-800">
              {`{{${entry.name}}}`}
            </dt>
            <dd className="text-xs text-gray-700">{t(entry.descriptionKey)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
