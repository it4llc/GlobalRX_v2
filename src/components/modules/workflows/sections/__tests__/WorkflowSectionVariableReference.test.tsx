// /GlobalRX_v2/src/components/modules/workflows/sections/__tests__/WorkflowSectionVariableReference.test.tsx
//
// Task 8.1 — Pass 2 component tests for WorkflowSectionVariableReference.
//
// The variable reference panel is admin-facing UI rendered inside the workflow
// section content editor. It shows the list of supported template variables
// (per the spec "Supported Variables (v1)" table) so the internal team knows
// what `{{placeholder}}` syntax they can type into section content.
//
// Coverage:
//   - Definition of Done item 7: admin workflow section content editor shows
//     a reference list of available variables with descriptions.
//   - Business Rule 8: admin UI editor must show the list of available
//     variables.
//   - Spec "Supported Variables (v1)" table: every one of the six v1 names
//     is rendered with its `{{name}}` placeholder syntax and a description.
//
// Mocking notes:
//   - The SUT (WorkflowSectionVariableReference) is NOT mocked per Mocking
//     Rule M1.
//   - The shared registry (`@/lib/templates/variableRegistry`) is NOT mocked.
//     The registry is the source of truth for which entries the SUT renders;
//     mocking it would mean the test verifies a fabrication rather than the
//     real six v1 entries. Per Rule M3, scripted return values are forbidden
//     for utility functions called with real arguments — and the registry is
//     a `const` array, so an inline mock implementation is not applicable.
//     Letting the real registry render through is the correct discipline.
//   - The component reads its display text from TranslationContext using the
//     registry's `descriptionKey` plus heading/intro keys. The test mocks
//     `useTranslation` with a key→English map drawn from `en-US.json` so the
//     assertions remain readable; any drift between the keys the component
//     requests and the keys this mock knows will surface as a missing-text
//     failure (which is the behavior we want — it pins the component to the
//     locale file contract).
//   - The component renders as a <tr>, so the test wraps it in a real
//     <table><tbody> in jsdom to avoid React table-nesting warnings.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Mock the translation context with the exact English strings that live in
// `src/translations/en-US.json` under `admin.workflowSection.variable.*`.
// If any key the component requests is not in this map, `t` returns the key
// itself, which will cause the visible-text assertions below to fail with a
// clear diff — surfacing the contract break loudly.
const EN_US_TRANSLATIONS: Record<string, string> = {
  'admin.workflowSection.variable.heading': 'Available template variables',
  'admin.workflowSection.variable.intro':
    'Type any of these placeholders into the content. The candidate will see the real value when they view the page.',
  'admin.workflowSection.variable.candidateFirstName.desc':
    "Candidate's first name",
  'admin.workflowSection.variable.candidateLastName.desc':
    "Candidate's last name",
  'admin.workflowSection.variable.candidateEmail.desc':
    "Candidate's email address",
  'admin.workflowSection.variable.candidatePhone.desc':
    "Candidate's phone number",
  'admin.workflowSection.variable.companyName.desc':
    "Customer's company name",
  'admin.workflowSection.variable.expirationDate.desc':
    'When the invite link expires (formatted as dd MMM yyyy)',
};

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => EN_US_TRANSLATIONS[key] ?? key,
  }),
}));

import WorkflowSectionVariableReference from '../WorkflowSectionVariableReference';
import { TEMPLATE_VARIABLE_REGISTRY } from '@/lib/templates/variableRegistry';

// Tests render the panel inside a real <table><tbody> because the SUT is a
// <tr> with colSpan=3 — its parent dialog mounts it inside a FormTable
// <table>. Without this wrapper, jsdom hoists the <tr> out of context and
// React emits a "cannot appear as a child of div" warning that pollutes the
// test output.
function renderInsideTable(): ReturnType<typeof render> {
  return render(
    <table>
      <tbody>
        <WorkflowSectionVariableReference />
      </tbody>
    </table>,
  );
}

// Expected description per registry name, derived from the en-US translation
// strings the mock above resolves the registry's `descriptionKey` values to.
// Kept indexed by variable name (rather than translation key) so the
// assertions below read clearly.
const EXPECTED_DESCRIPTIONS: Record<string, string> = {
  candidateFirstName:
    EN_US_TRANSLATIONS['admin.workflowSection.variable.candidateFirstName.desc'],
  candidateLastName:
    EN_US_TRANSLATIONS['admin.workflowSection.variable.candidateLastName.desc'],
  candidateEmail:
    EN_US_TRANSLATIONS['admin.workflowSection.variable.candidateEmail.desc'],
  candidatePhone:
    EN_US_TRANSLATIONS['admin.workflowSection.variable.candidatePhone.desc'],
  companyName:
    EN_US_TRANSLATIONS['admin.workflowSection.variable.companyName.desc'],
  expirationDate:
    EN_US_TRANSLATIONS['admin.workflowSection.variable.expirationDate.desc'],
};

describe('WorkflowSectionVariableReference', () => {
  describe('panel structure', () => {
    it('renders the panel container with its testid', () => {
      renderInsideTable();

      expect(
        screen.getByTestId('workflow-section-variable-reference'),
      ).toBeInTheDocument();
    });

    it('renders the "Available template variables" heading', () => {
      renderInsideTable();

      const heading = screen.getByRole('heading', { level: 4 });
      expect(heading).toHaveTextContent('Available template variables');
    });

    it('renders the intro/help line so admins know what the panel is for', () => {
      renderInsideTable();

      // The intro text guides the admin to type placeholders into content.
      expect(
        screen.getByText(
          /Type any of these placeholders into the content/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe('registry coverage (DoD #7, BR 8, spec Supported Variables v1 table)', () => {
    it('renders exactly one row per registry entry', () => {
      renderInsideTable();

      const panel = screen.getByTestId('workflow-section-variable-reference');

      // Each registry entry produces one <dt> (placeholder) + one <dd> (desc).
      const dts = panel.querySelectorAll('dt');
      const dds = panel.querySelectorAll('dd');

      expect(dts.length).toBe(TEMPLATE_VARIABLE_REGISTRY.length);
      expect(dds.length).toBe(TEMPLATE_VARIABLE_REGISTRY.length);
    });

    // Iterate over the REAL registry so a future addition (or removal) is
    // surfaced automatically: the spec's "Supported Variables (v1)" table is
    // codified by TEMPLATE_VARIABLE_REGISTRY, and this test pins each entry
    // to a visible row in the panel.
    it.each(TEMPLATE_VARIABLE_REGISTRY.map((e) => [e.name]))(
      'renders the {{%s}} placeholder text',
      (name) => {
        renderInsideTable();

        // BR 1 — variables use double curly brace syntax. The panel must
        // display the EXACT placeholder text the admin needs to type, not
        // a translated label or a stripped-of-braces name.
        expect(screen.getByText(`{{${name}}}`)).toBeInTheDocument();
      },
    );

    it.each(TEMPLATE_VARIABLE_REGISTRY.map((e) => [e.name]))(
      'renders the description for %s next to its placeholder',
      (name) => {
        renderInsideTable();

        const expected = EXPECTED_DESCRIPTIONS[name];
        expect(expected).toBeTruthy();
        expect(screen.getByText(expected)).toBeInTheDocument();
      },
    );

    it('renders placeholders in registry order', () => {
      renderInsideTable();

      const panel = screen.getByTestId('workflow-section-variable-reference');
      const dts = Array.from(panel.querySelectorAll('dt'));
      const rendered = dts.map((dt) => dt.textContent);
      const expected = TEMPLATE_VARIABLE_REGISTRY.map(
        (e) => `{{${e.name}}}`,
      );

      expect(rendered).toEqual(expected);
    });
  });

  describe('admin-facing rendering details', () => {
    it('renders the placeholder names in a monospaced style so admins can copy them verbatim', () => {
      renderInsideTable();

      const panel = screen.getByTestId('workflow-section-variable-reference');
      const dts = panel.querySelectorAll('dt');

      // Every <dt> uses the font-mono Tailwind utility class. This is part
      // of the admin UX: the placeholder text must be visually distinct from
      // the surrounding description so the admin can't confuse syntax with
      // prose when copying.
      dts.forEach((dt) => {
        expect(dt.className).toContain('font-mono');
      });
    });

    it('descriptions for every registered variable are visible inside the panel container', () => {
      renderInsideTable();

      const panel = screen.getByTestId('workflow-section-variable-reference');

      for (const entry of TEMPLATE_VARIABLE_REGISTRY) {
        const description = EXPECTED_DESCRIPTIONS[entry.name];
        // within() pins the description to the panel's DOM subtree so a
        // matching string elsewhere on the page (in the wrapper table)
        // can't satisfy the assertion by accident.
        expect(within(panel).getByText(description)).toBeInTheDocument();
      }
    });

    it('does NOT render inviteLink (not in v1 registry per spec)', () => {
      renderInsideTable();

      // Plan Risks item 2/8: inviteLink is intentionally not in the v1
      // workflow-section registry. A candidate viewing a section has already
      // clicked the link, so the variable would be useless there. This test
      // is a regression guard against a future change that adds it to the
      // workflow-section panel without first updating the spec.
      expect(screen.queryByText('{{inviteLink}}')).not.toBeInTheDocument();
    });
  });
});
