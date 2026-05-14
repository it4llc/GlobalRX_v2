// /GlobalRX_v2/src/components/modules/workflows/sections/WorkflowSectionVariableReference.tsx

/**
 * Admin-facing reference panel for the template variables that the
 * workflow-section content editor supports. Reads its entries from the
 * shared registry so adding a future variable surfaces here automatically
 * without touching this component.
 *
 * Rendered as a <tr> with a colSpan cell because the parent FormTable is
 * a real <table>; a bare <div> would be hoisted out of <tbody> by the
 * browser and break the dialog's width constraint.
 *
 * Strings are pulled from the translation context via the registry's
 * `descriptionKey` plus the heading/intro keys under
 * `admin.workflowSection.variable.*`. Keys live in every locale file.
 */

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import { TEMPLATE_VARIABLE_REGISTRY } from '@/lib/templates/variableRegistry';

export default function WorkflowSectionVariableReference() {
  const { t } = useTranslation();

  return (
    <tr data-testid="workflow-section-variable-reference">
      <td colSpan={3} className="pt-2">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <h4 className="text-sm font-semibold text-gray-900">
            {t('admin.workflowSection.variable.heading')}
          </h4>
          <p className="mt-1 text-xs text-gray-600">
            {t('admin.workflowSection.variable.intro')}
          </p>
          <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
            {TEMPLATE_VARIABLE_REGISTRY.map((entry) => (
              <React.Fragment key={entry.name}>
                <dt className="font-mono text-xs text-gray-800">
                  {`{{${entry.name}}}`}
                </dt>
                <dd className="min-w-0 break-words text-xs text-gray-700">
                  {t(entry.descriptionKey)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </td>
    </tr>
  );
}
