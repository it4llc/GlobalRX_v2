# Template Variable System

**Task:** 8.1
**Branch:** `feature/verification-idv-conversion`
**Date:** 2026-05-13

## Overview

Workflow section content (the informational pages candidates see during their application — Welcome, Consent, etc.) supports `{{variableName}}` placeholders that are replaced with real candidate data at display time. Replacement is read-only: the stored content in the database retains the placeholder text and values are substituted fresh on every page view.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/templates/variableRegistry.ts` | Single source of truth for supported variable names, description translation keys, and categories. Import from here when you need to iterate over the registry. |
| `src/lib/templates/replaceTemplateVariables.ts` | The shared replacement function. Takes `content` and `TemplateVariableValues`, returns the substituted string. Call this before DOMPurify sanitization. |
| `src/types/templateVariables.ts` | Public re-export of all types (`TemplateVariableName`, `TemplateVariableCategory`, `TemplateVariableValues`, `TemplateVariableRegistryEntry`). Import types from here, not from `src/lib/templates/*`. |
| `src/components/modules/workflows/sections/WorkflowSectionVariableReference.tsx` | Admin-facing reference panel component. Reads from the registry so it automatically reflects new variables. Rendered inside `WorkflowSectionDialog` when `type === 'text'`. |

## Supported Variables (v1)

| Placeholder | Displays | Source |
|-------------|----------|--------|
| `{{candidateFirstName}}` | Candidate's first name | `candidate_invitations.firstName` |
| `{{candidateLastName}}` | Candidate's last name | `candidate_invitations.lastName` |
| `{{candidateEmail}}` | Candidate's email address | `candidate_invitations.email` |
| `{{candidatePhone}}` | Candidate's phone number | `candidate_invitations.phoneCountryCode` + `phoneNumber` (combined) |
| `{{companyName}}` | Customer's company name | `customers.name` via the order |
| `{{expirationDate}}` | Invite link expiry date | `candidate_invitations.expiresAt` formatted as `dd MMM yyyy` (English only; see note below) |

`inviteLink` is not in v1. A candidate viewing a workflow section has already clicked the invite link, so the variable is not useful at render time. When email-send code is built, `inviteLink` can be added to the registry and used from that context.

## Where Values Come From

`portal-layout.tsx` builds a `templateVariableValues` object via `useMemo` from the `invitation` prop and passes it as `variableValues` to `WorkflowSectionRenderer`. The `invitation` prop is populated from the `GET /api/candidate/application/[token]/structure` response, which was extended in Task 8.1 to include `email` and `phone` in the invitation block.

`expirationDate` is formatted in `portal-layout.tsx` using `date-fns` `format(date, 'dd MMM yyyy')`. This is English-only by design. If the candidate application gains locale support in the future, `portal-layout.tsx` is the single place to update.

## How Replacement Works

`replaceTemplateVariables(content, values)` applies the regex `/\{\{(\w+)\}\}/g` to the content string. For each match:

- If the name is in the registry and the value is a non-empty string: replaced with the value.
- If the name is in the registry but the value is `null`, `undefined`, or empty: replaced with `''`.
- If the name is not in the registry: replaced with `''`.

Malformed syntax like `{{name}` (missing one closing brace) does not match the regex and is left as literal text.

**Replacement happens before DOMPurify sanitization.** This ensures that any HTML or script content inside a variable value is cleaned along with the rest of the merged content. The call order in `WorkflowSectionRenderer` is `sanitizeWorkflowContent(replaceTemplateVariables(content, values))`.

## Adding a New Variable

1. Add the name to the `TemplateVariableName` union in `variableRegistry.ts`.
2. Add the registry entry (name, descriptionKey, category) to `TEMPLATE_VARIABLE_REGISTRY` in `variableRegistry.ts`.
3. Add translation keys in `src/translations/en-US.json` (and mirror to the other four locale files).
4. Wire the value into the `templateVariableValues` `useMemo` in `portal-layout.tsx`.

The `variableRegistry.test.ts` suite will catch shape errors or duplicate names.

## Future Use: Email Templates

`replaceTemplateVariables` is also the function future email-send code must use. No email send call sites exist today (the candidate-invitation service explicitly defers sending). The registry is the shared contract — adding a variable here makes it available to both workflow section rendering and future email sending.

The existing `workflow-dialog.tsx` email template hint list is hardcoded and includes `{{inviteLink}}` (not in the v1 registry). That list has not been migrated to read from this registry. Migration should happen when email-send code is built.
