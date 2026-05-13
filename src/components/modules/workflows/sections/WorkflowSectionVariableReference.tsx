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
 * Strings are hardcoded English to match the surrounding admin-dialog
 * convention (workflow-section-dialog.tsx labels are all hardcoded
 * English). The spec notes that the candidate-facing side is
 * English-only in v1, and this panel is internal/admin only.
 */

'use client';

import React from 'react';

import { TEMPLATE_VARIABLE_REGISTRY, TemplateVariableName } from '@/lib/templates/variableRegistry';

const VARIABLE_DESCRIPTIONS: Record<TemplateVariableName, string> = {
  candidateFirstName: "Candidate's first name",
  candidateLastName: "Candidate's last name",
  candidateEmail: "Candidate's email address",
  candidatePhone: "Candidate's phone number",
  companyName: "Customer's company name",
  expirationDate: 'When the invite link expires (formatted as dd MMM yyyy)',
};

export default function WorkflowSectionVariableReference() {
  return (
    <tr data-testid="workflow-section-variable-reference">
      <td colSpan={3} className="pt-2">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Available template variables
          </h4>
          <p className="mt-1 text-xs text-gray-600">
            Type any of these placeholders into the content. The candidate will see the real value when they view the page.
          </p>
          <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
            {TEMPLATE_VARIABLE_REGISTRY.map((entry) => (
              <React.Fragment key={entry.name}>
                <dt className="font-mono text-xs text-gray-800">
                  {`{{${entry.name}}}`}
                </dt>
                <dd className="min-w-0 break-words text-xs text-gray-700">
                  {VARIABLE_DESCRIPTIONS[entry.name]}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </td>
    </tr>
  );
}
