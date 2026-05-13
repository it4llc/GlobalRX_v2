# Technical Plan: Template Variable System for Workflow Sections

**Based on specification:** `docs/specs/template-variable-system.md` (May 13, 2026)
**Date:** May 13, 2026
**Branch:** `feature/verification-idv-conversion` (current; implementer should create a new feature branch off this branch's HEAD)

---

## Critical Finding: No Existing Runtime Email Variable Replacement

The spec assumes there is existing email-template variable replacement code that must be consolidated. **There is not.**

What exists today:

1. `Workflow.emailSubject` and `Workflow.emailBody` are stored on the workflow row (per `prisma/schema.prisma` / `src/components/modules/workflows/workflow-dialog.tsx`). The admin can type a body containing `{{candidateFirstName}}` etc.
2. The admin UI in `workflow-dialog.tsx` (lines 522–531) shows a hardcoded HTML reference list of variable names: `candidateFirstName`, `candidateLastName`, `candidateEmail`, `candidatePhone`, `companyName`, `inviteLink`, `expirationDate`.
3. The candidate-invitation service explicitly defers email sending: `// Note: Actual email sending will be implemented in a future phase` (`src/lib/services/candidate-invitation.service.ts` line 479, and in the resend route).
4. The only `{{var}}` interpolation code in the project is the i18n translation `t(key, params)` system in `src/contexts/TranslationContext.tsx` and `src/lib/i18n/server-translations.ts` — that is unrelated (it takes already-known placeholder values and substitutes them into translated strings; it is not a template-variable-for-emails system).

**Implication for this plan:** the "consolidation" the spec requires is forward-looking: we will create the single shared function now, refactor the workflow-dialog reference list to read from the shared registry (so the list itself becomes authoritative and is shared between the admin UI and the renderer), and the future email-send code will use the same function from day one. No existing email-send call sites need to be refactored because none exist yet.

This is explicitly called out in the Risks section so the implementer does not search fruitlessly for email send code to refactor.

---

## Database Changes

**None.** No schema changes, no migrations, no new columns. All required source data already exists on `candidate_invitations` (`firstName`, `lastName`, `email`, `phoneCountryCode`, `phoneNumber`, `expiresAt`) and `customers` (`name`).

---

## New Files to Create

### 1. `/src/lib/templates/variableRegistry.ts`

**Purpose:** The single source of truth for which template variables are supported, their human-readable descriptions (translation keys), and which category they belong to. Imported by both the shared replacement function (validation of which names are "recognized") and the admin UI reference panel (display of the list).

**Contents:**
- `TemplateVariableCategory` type (literal union: `'candidate' | 'company' | 'invitation'`).
- `TemplateVariableName` type (literal union of the 6 v1 names — see below).
- `TemplateVariableRegistryEntry` interface: `{ name: TemplateVariableName; descriptionKey: string; category: TemplateVariableCategory }`.
- `TEMPLATE_VARIABLE_REGISTRY: readonly TemplateVariableRegistryEntry[]` — the 6 v1 entries.
- `TEMPLATE_VARIABLE_NAMES: readonly TemplateVariableName[]` — derived from the registry for fast `Set` lookup in the replacer.
- Helper `getTemplateVariableNameSet(): Set<string>` (memoised) used by the replacement function.

**The 6 v1 entries (final, exact):**

| name                  | descriptionKey                                  | category     |
|-----------------------|-------------------------------------------------|--------------|
| `candidateFirstName`  | `admin.workflowSection.variable.candidateFirstName.desc` | `candidate`  |
| `candidateLastName`   | `admin.workflowSection.variable.candidateLastName.desc`  | `candidate`  |
| `candidateEmail`      | `admin.workflowSection.variable.candidateEmail.desc`     | `candidate`  |
| `candidatePhone`      | `admin.workflowSection.variable.candidatePhone.desc`     | `candidate`  |
| `companyName`         | `admin.workflowSection.variable.companyName.desc`        | `company`    |
| `expirationDate`      | `admin.workflowSection.variable.expirationDate.desc`     | `invitation` |

Note: `inviteLink` (visible in the legacy workflow-dialog hint list) is **not** in v1 of this registry per the spec's "Supported Variables (v1)" table. The plan deliberately drops it from the shared list — see Risks section row 3 for the implication for the workflow-dialog email template hint list.

---

### 2. `/src/lib/templates/replaceTemplateVariables.ts`

**Purpose:** The shared text-in / text-out replacement function. Called by `WorkflowSectionRenderer` (and by future email-send code).

**Contents:**
- `TemplateVariableValues` interface: `{ candidateFirstName?: string | null; candidateLastName?: string | null; candidateEmail?: string | null; candidatePhone?: string | null; companyName?: string | null; expirationDate?: string | null; }`.
- `replaceTemplateVariables(content: string | null | undefined, values: TemplateVariableValues): string`:
  1. If `content` is null/undefined/empty, return `''`.
  2. Use a single regex `/\{\{(\w+)\}\}/g` against the content. Only proper `{{word}}` matches; malformed syntax like `{{name}` or `{var}}` is not matched and is left untouched (spec edge case 3).
  3. For each match, look up the captured name in the registry's name set.
     - If it is a recognized name AND `values[name]` is a non-empty string → replace with that string.
     - Otherwise (unrecognized name, or recognized name with `null`/`undefined`/empty value) → replace with empty string.
  4. Return the resulting string. No HTML escaping is done here — sanitization is the caller's responsibility (DOMPurify runs AFTER this function in `WorkflowSectionRenderer`).
- The function is pure, synchronous, no side effects, no DOM, no eval, no `Function()`, no logging.
- File begins with the standard file-path comment.

---

### 3. `/src/lib/templates/__tests__/replaceTemplateVariables.test.ts`

**Purpose:** Unit tests for the shared replacement function. The test-writer agent owns the test content; this entry is here so the implementer knows the file exists and may be present in the working tree by the time they run.

**Required coverage (the test-writer agent will translate this into actual tests):**
- Recognized variable replaced with its value.
- Recognized variable with empty/null/undefined/missing value → replaced with empty string.
- Unrecognized variable → replaced with empty string.
- Malformed syntax `{{name}` (single closing brace) left untouched.
- Malformed syntax `{name}}` (single opening brace) left untouched.
- Content with no variables returned unchanged.
- Same variable used multiple times → all occurrences replaced.
- Multiple different variables in the same string all replaced.
- Variable value containing HTML / `<script>` is passed through unchanged (sanitization is the caller's job).
- Null / undefined / empty content returns `''`.
- No code execution: a value like `${alert(1)}` is returned literally.

---

### 4. `/src/lib/templates/__tests__/variableRegistry.test.ts`

**Purpose:** Unit tests asserting the registry shape, that the v1 names match the spec exactly, that every entry has the three required fields, and that there are no duplicates. Prevents regressions when adding future variables.

---

### 5. `/src/components/modules/workflows/sections/WorkflowSectionVariableReference.tsx`

**Purpose:** The admin-facing reference panel rendered inside `WorkflowSectionDialog` showing the available template variables. Kept as a separate component so the dialog file stays under its file-size budget and so the panel can be reused later (e.g., on the email template editor in `workflow-dialog.tsx`).

**Contents:**
- `'use client'`.
- Default-exported function component (no props for v1 — it reads exclusively from the registry).
- Renders a small heading (translated) + a two-column grid with one row per registry entry: left column shows `{{<name>}}` in a monospace style; right column shows the translated description.
- Pulls strings via `useTranslation` from `@/contexts/AuthContext`-adjacent `@/contexts/TranslationContext`.
- Imports `TEMPLATE_VARIABLE_REGISTRY` from `@/lib/templates/variableRegistry`.
- File begins with the standard file-path comment.
- Uses Tailwind utility classes only — no inline styles.

---

### 6. `/src/components/modules/workflows/sections/__tests__/WorkflowSectionVariableReference.test.tsx`

**Purpose:** Component test asserting that every entry in `TEMPLATE_VARIABLE_REGISTRY` is rendered, in registry order, with the correct `{{name}}` text and the translated description key. Regression test when a variable is later added to the registry.

---

### 7. `/src/types/templateVariables.ts`

**Purpose:** Public TypeScript types for the template variable system, re-exported so consumers do not have to import directly from `/src/lib/templates/...`. Follows the "types live in `/src/types/`" rule from `CODING_STANDARDS.md` Section 3.3.

**Contents:**
- Re-exports `TemplateVariableName`, `TemplateVariableCategory`, `TemplateVariableValues`, `TemplateVariableRegistryEntry` from the registry/replacer modules.
- File begins with the standard file-path comment.

---

## Existing Files to Modify

### 1. `/src/components/candidate/form-engine/WorkflowSectionRenderer.tsx` (READ — 136 lines)

**What currently exists:**
- Client component, default export `WorkflowSectionRenderer`.
- Props: `section`, `acknowledged`, `onAcknowledge`, `sectionValidation`, `errorsVisible`.
- For `type === 'text'` sections, renders `<div dangerouslySetInnerHTML={{ __html: sanitizeWorkflowContent(section.content ?? '') }} />`.
- Does NOT do any variable replacement.

**What needs to change:**
- Add a new optional prop `variableValues?: TemplateVariableValues` (default `{}` when omitted, so existing callers do not break).
- Import `replaceTemplateVariables` from `@/lib/templates/replaceTemplateVariables` and `type { TemplateVariableValues } from '@/types/templateVariables'`.
- In the `type === 'text'` branch, change the `dangerouslySetInnerHTML` line to first run the content through `replaceTemplateVariables(section.content ?? '', variableValues ?? {})` and THEN pass the result to `sanitizeWorkflowContent`. The replacement MUST happen before sanitization (spec Business Rule 2 / Edge Cases row 4).
- Update the file-header comment to document the new behaviour.

**Confirmation:** This file was read before listing. The replacement must be the literal call order `sanitizeWorkflowContent(replaceTemplateVariables(rawContent, values))`.

---

### 2. `/src/components/candidate/form-engine/WorkflowSectionRenderer.test.tsx` (READ — 367 lines)

**What currently exists:**
- Component test suite for `WorkflowSectionRenderer`. Mocks `sanitizeWorkflowContent` as identity (passes input through unchanged). Asserts that `content.innerHTML` matches the literal section content.

**What needs to change:**
- The existing assertions that check `content.innerHTML === '<p>Please review.</p>'` would still pass because the test content has no `{{...}}` placeholders and the replacement function returns content unchanged when there are no placeholders. **But** the test file should be expanded to assert the new behavior:
  1. Add a mock for `@/lib/templates/replaceTemplateVariables` mirroring the existing identity-mock pattern for `sanitizeWorkflowContent` (per the file's Mocking Rule M3 comment) — an inline implementation that READS its arguments and returns its first argument as-is, so the test can assert the renderer wired the call correctly.
  2. Add a test that verifies the renderer calls `replaceTemplateVariables` with `(section.content, props.variableValues)` BEFORE `sanitizeWorkflowContent`, by importing both mocks and asserting their `mock.calls.length` and call order (using `vi.fn().mock.invocationCallOrder`).
  3. Add a test that asserts when `variableValues` is omitted, the renderer falls back to an empty values object and does not throw.
- Tests for the text-content branch may need their mock content updated to include `{{candidateFirstName}}` and assert it is passed to the mocked replacer along with values — the test-writer will design these per their own standards.

**Confirmation:** This file was read before listing.

---

### 3. `/src/app/api/candidate/application/[token]/structure/route.ts` (READ — 425 lines)

**What currently exists:**
- The response's `invitation` block returns: `firstName`, `lastName`, `status`, `expiresAt`, `companyName`. It does NOT return `email` or `phone`.
- The Prisma query already loads `invitation.email`, `invitation.phoneCountryCode`, `invitation.phoneNumber` (they are non-selected columns on the included row), so no new include/select is required.

**What needs to change:**
- Extend the `invitation` block in the response to additionally return:
  - `email: invitation.email`
  - `phone: <derived>` — a single string combining `phoneCountryCode` + `phoneNumber` when both are present, else just `phoneNumber` when only that is present, else `null`. Documented in code: "Combined into a single display string here so the candidate UI does not have to know the storage shape."
- Update the JSDoc block (`Response shape` section) to document the new `email` and `phone` fields per `API_STANDARDS.md` Section 11.
- Do NOT log PII (per `CODING_STANDARDS.md` Section 5.2) — no changes to any `logger.*` calls.

**Confirmation:** This file was read before listing.

---

### 4. `/src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts` (READ — 756 lines)

**What currently exists:**
- A test (lines 187–193) asserts `data.invitation` with `toEqual({ firstName, lastName, status, expiresAt, companyName })`. `toEqual` is strict — adding fields to the response will cause this assertion to fail.
- Mock invitation rows include `email: 'sarah@example.com'`, `phoneCountryCode: null`, `phoneNumber: null` at lines 34, 43–44.

**What needs to change:**
- Update the `toEqual` assertion at line 187 to include the new `email` and `phone` fields.
- Add at least one new test case that verifies the phone-combining logic across all three states: (a) both `phoneCountryCode` and `phoneNumber` present → combined string; (b) only `phoneNumber` present → just the number; (c) both null → `phone: null`. The test-writer will design the exact assertions.

**Confirmation:** This file was read before listing.

---

### 5. `/src/types/candidate-portal.ts` (READ — 157 lines)

**What currently exists:**
- `interface CandidateInvitationInfo { firstName: string; lastName: string; status: string; expiresAt: Date; companyName: string; }`.

**What needs to change:**
- Add two new fields to `CandidateInvitationInfo`:
  - `email: string` (always present on the row; the Prisma column is non-nullable).
  - `phone: string | null` (nullable — depends on whether the invite included phone numbers).
- The file already uses `@/`-prefixed type imports; no import changes needed.

**Confirmation:** This file was read before listing.

---

### 6. `/src/components/candidate/portal-layout.tsx` (READ — 841 lines)

**What currently exists:**
- Receives `invitation: CandidateInvitationInfo` and `sections` props.
- Dispatches to `WorkflowSectionRenderer` at lines 788–800 when `section.type === 'workflow_section'`.
- Does not currently build any template variable values object.
- **File is over the 600-line file-size hard stop (`CODING_STANDARDS.md` Section 9.1).** The implementer's Rule 10 (in `.claude/agents/implementer.md`) requires a deliberate decision before adding code to files in this range. The plan explicitly authorises adding the minimum needed (one `useMemo` of ~12 lines and one new prop on one call site of ~1 line) — no other additions to this file are permitted as part of this task. If the implementer needs more code than that, they must stop and ask.

**What needs to change:**
1. Add an import for `type { TemplateVariableValues } from '@/types/templateVariables'`.
2. Add an import for `format` from `'date-fns'` (used to format `expirationDate` as `dd MMM yyyy`).
3. After the existing `useMemo` blocks (somewhere after `subjectCrossSectionRequirements`), add a new `useMemo` that derives a `templateVariableValues: TemplateVariableValues` object from the `invitation` prop:
   - `candidateFirstName: invitation.firstName ?? null`
   - `candidateLastName: invitation.lastName ?? null`
   - `candidateEmail: invitation.email ?? null`
   - `candidatePhone: invitation.phone ?? null`
   - `companyName: invitation.companyName ?? null`
   - `expirationDate: invitation.expiresAt ? format(new Date(invitation.expiresAt), 'dd MMM yyyy') : null`
   - Dependency array: `[invitation]`.
   - Comment explaining: "Single source of values for `replaceTemplateVariables`. The expirationDate is formatted as `dd MMM yyyy` here (English-only per spec Resolved Question #3); when the candidate app gains locale support this is the one place that needs to change."
4. Pass `variableValues={templateVariableValues}` as a new prop on the `<WorkflowSectionRenderer ... />` call at lines 791–796.

**Net additions:** approximately 12–14 lines. No removals, no refactors. This is the only file in the plan that is over the 600-line soft trigger.

**Confirmation:** This file was read before listing.

---

### 7. `/src/components/modules/workflows/sections/workflow-section-dialog.tsx` (READ — 395 lines)

**What currently exists:**
- The workflow section content editor dialog. Renders a `<Textarea>` bound to `content` for `type === 'text'` sections (line 341–347).
- Does NOT currently show any template-variable hints inside this dialog (the visible hint list elsewhere in the codebase is in `workflow-dialog.tsx`, a different file, which edits the parent Workflow's email template — not the workflow section content).

**What needs to change:**
- Import `WorkflowSectionVariableReference` from `@/components/modules/workflows/sections/WorkflowSectionVariableReference`.
- Inside the `{watchedType === 'text' && (...)}` block (immediately after the existing `FormRow` for "Content"), render `<WorkflowSectionVariableReference />` so the reference panel sits directly below the textarea while the editor is in text mode. The component is self-contained, so the addition is one import + one JSX element (~3 lines).

**Confirmation:** This file was read before listing. The variable reference panel must only show for text-type sections (it has no relevance for document-type sections).

---

### 8. `/src/translations/en-US.json` (READ — confirmed via grep that `candidate.workflowSection.*` keys exist at lines 676–678)

**What needs to change:** add the new admin-facing translation keys listed in the "Translation Keys" section below. Insert them in the existing alphabetical/grouped position the file already uses for `admin.*` keys (the implementer will choose the insertion point that minimises diff churn).

**Confirmation:** This file was read (key region around line 676 confirmed via grep; the full file is large and the relevant section is the only one that changes).

---

### 9. `/src/translations/en-GB.json`, `/src/translations/es-ES.json`, `/src/translations/es.json`, `/src/translations/ja-JP.json`

**What needs to change:** add the same new keys as in `en-US.json`. Per existing project convention (visible in the same files for `candidate.landing.welcome` etc.), non-English locales may carry the English string as a placeholder until translations are produced — this matches what the project already does for many other keys. The plan does NOT require translated text in non-English files; only that the keys exist with at least the English value so the `t()` lookup does not fall back to the raw key.

**Confirmation:** These files were not read line-by-line, but their existence was verified via `ls /Users/andyhellman/Projects/GlobalRx_v2/src/translations/`. The implementer is permitted to add keys to these files because they are listed here explicitly.

---

## API Routes

### Modified: `GET /api/candidate/application/[token]/structure`

- **Authentication:** unchanged (candidate session cookie matching the URL token).
- **Permissions:** unchanged.
- **Input:** unchanged (`token` path param).
- **Response shape changes:** the `invitation` object gains two new fields:
  - `email: string` — `candidate_invitations.email`.
  - `phone: string | null` — combined `phoneCountryCode + phoneNumber` (with single space separator) when both present; `phoneNumber` alone when only that present; `null` when neither.
- **Errors:** unchanged (401 / 400 / 403 / 404 / 500).
- **JSDoc:** must be updated per `API_STANDARDS.md` Section 11.3.

**No new API routes are needed.** The candidate application already loads structure once on mount; we are extending its existing payload rather than adding a second fetch.

---

## Zod Validation Schemas

**No new Zod schemas are needed.** This feature does not accept any new user input. The replacement function operates on already-validated stored content and on values that come from authenticated session-scoped database rows.

---

## TypeScript Types

### In `/src/lib/templates/variableRegistry.ts` (new file):
- `TemplateVariableName` — string-literal union of the 6 v1 names.
- `TemplateVariableCategory` — `'candidate' | 'company' | 'invitation'`.
- `TemplateVariableRegistryEntry` — `{ name: TemplateVariableName; descriptionKey: string; category: TemplateVariableCategory }`.

### In `/src/lib/templates/replaceTemplateVariables.ts` (new file):
- `TemplateVariableValues` — `{ [K in TemplateVariableName]?: string | null }` (Partial with nullable string values).

### In `/src/types/templateVariables.ts` (new file):
- Re-exports of all of the above. This is the canonical import path for consumers.

### In `/src/types/candidate-portal.ts` (modified):
- `CandidateInvitationInfo` gains `email: string` and `phone: string | null`.

**No types are derived from Zod schemas in this feature** because there are no new Zod schemas (per the section above).

---

## UI Components

### Modified: `WorkflowSectionRenderer`
- Server/client: existing client component (`'use client'`).
- What it renders: unchanged externally (heading, content container, ack checkbox). Internally, runs `replaceTemplateVariables(content, variableValues)` BEFORE `sanitizeWorkflowContent`.
- Existing UI it uses: `SectionErrorBanner` (unchanged).
- API routes it calls: none (unchanged — pure display).

### Modified: `portal-layout.tsx`
- Server/client: existing client component (`'use client'`).
- What it renders: unchanged.
- Existing UI it uses: many (`WorkflowSectionRenderer`, etc.) — only the prop list on `WorkflowSectionRenderer` changes.
- API routes it calls: unchanged.

### Modified: `WorkflowSectionDialog`
- Server/client: existing client component (`'use client'`).
- What it renders: existing form + the new `WorkflowSectionVariableReference` panel inside the text-content branch.
- Existing UI it uses: `ModalDialog`, `FormTable`, `FormRow`, `Input`, `Textarea`, `Checkbox`, `Select`, `AlertBox` (per `COMPONENT_STANDARDS.md` conventions; all unchanged).
- API routes it calls: unchanged (`/api/workflows/[id]/sections`, etc.).

### New: `WorkflowSectionVariableReference`
- Server/client: client component (`'use client'`) so it can call `useTranslation`.
- What it renders: a small heading + a two-column grid with one row per registry entry — `{{name}}` (monospace) and the translated description. Read-only, no interaction in v1 (the spec Resolved Question #2 explicitly allows reference-only for v1).
- Existing UI it uses: none of the project's `FormTable`/`FormRow`/`ModalDialog` primitives (it is a small static reference panel; bare Tailwind utility classes are appropriate). All Tailwind classes, no inline styles, per `CODING_STANDARDS.md` "No Inline Styling" rule.
- API routes it calls: none.

---

## Translation Keys

All new keys are added to `en-US.json` with the English values shown below, and stub-added (same English value, per existing project convention) to `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`.

| Key | English value |
|---|---|
| `admin.workflowSection.variable.heading` | `Available template variables` |
| `admin.workflowSection.variable.intro` | `Type any of these placeholders into the content. The candidate will see the real value when they view the page.` |
| `admin.workflowSection.variable.candidateFirstName.desc` | `Candidate's first name` |
| `admin.workflowSection.variable.candidateLastName.desc` | `Candidate's last name` |
| `admin.workflowSection.variable.candidateEmail.desc` | `Candidate's email address` |
| `admin.workflowSection.variable.candidatePhone.desc` | `Candidate's phone number` |
| `admin.workflowSection.variable.companyName.desc` | `Customer's company name` |
| `admin.workflowSection.variable.expirationDate.desc` | `When the invite link expires (formatted as dd MMM yyyy)` |

The `heading` and `intro` keys are consumed by `WorkflowSectionVariableReference`. The six `*.desc` keys are referenced by the registry entries (the registry stores the key; the component does the `t()` lookup at render time).

---

## Order of Implementation

The implementer must follow this order. Each step must compile, pass type-checking, and pass any newly-added tests before moving to the next.

1. **No database changes** (skip).
2. **No Prisma migration** (skip).
3. **Create the variable registry** — `/src/lib/templates/variableRegistry.ts`.
4. **Create the shared replacement function** — `/src/lib/templates/replaceTemplateVariables.ts`.
5. **Create the public type re-export module** — `/src/types/templateVariables.ts`.
6. **Add the new translation keys** — start with `/src/translations/en-US.json`; mirror in the other four locale files.
7. **Create the admin reference panel component** — `/src/components/modules/workflows/sections/WorkflowSectionVariableReference.tsx`.
8. **Wire the reference panel into the section dialog** — modify `/src/components/modules/workflows/sections/workflow-section-dialog.tsx`.
9. **Update the `CandidateInvitationInfo` type** — modify `/src/types/candidate-portal.ts` to add `email` and `phone`.
10. **Update the structure API route** — modify `/src/app/api/candidate/application/[token]/structure/route.ts` to return `email` and `phone` in the `invitation` block (and update the JSDoc).
11. **Update the structure route test** — modify `/src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts` to match the new response shape and cover the phone-combining branches.
12. **Wire variables into the renderer** — modify `/src/components/candidate/form-engine/WorkflowSectionRenderer.tsx` to accept `variableValues` and call `replaceTemplateVariables` before `sanitizeWorkflowContent`.
13. **Update the renderer test** — modify `/src/components/candidate/form-engine/WorkflowSectionRenderer.test.tsx`.
14. **Pass values from the shell** — modify `/src/components/candidate/portal-layout.tsx` to build the values object and pass it down.
15. **Run the full type-check (`pnpm typecheck`)** — must pass clean.
16. **Run the full test suite (`pnpm vitest run`)** — must pass with zero net regression.

---

## Risks and Considerations

1. **No existing email-template runtime code to consolidate.** The spec assumes there is. There is not (see "Critical Finding" above). The plan still produces the single shared function the spec asked for, so the future email send code will use it from day one — but the implementer should NOT search for email-send call sites to refactor, because none exist yet. This is a documentation note only; the deliverable is unchanged.

2. **Behavioural parity gap: the workflow-dialog email template hint list is NOT being refactored to read from the new registry in this task.** The existing hardcoded list at `src/components/modules/workflows/workflow-dialog.tsx` lines 522–531 includes `{{inviteLink}}` which is NOT in the v1 registry. Replacing the hardcoded list with a `<TemplateVariableReference />` rendering would drop `inviteLink` from the visible hint, which is a behaviour change the spec does not explicitly authorise. We are leaving the email-template hint list alone; when the email-send code is built (a future task) the registry can be extended to include `inviteLink` (which is invitation-link-specific and only meaningful at email-send time, not at workflow-section-render time — the candidate viewing a section is already past the link click) and the hint list can be migrated at that time. Andy should confirm this is acceptable for v1 before the implementer starts.

3. **`expirationDate` is English-only by design (spec Resolved Question #3).** The format string `'dd MMM yyyy'` from `date-fns` produces month abbreviations in the runtime locale of the `format()` call; in our Node.js / browser environment with no `Intl` locale argument, this defaults to English. If the candidate app ever gains true locale support, the `useMemo` block in `portal-layout.tsx` is the single point that needs updating — comment in the code calls this out so the next change is obvious.

4. **`portal-layout.tsx` is already over the 600-line agent hard stop.** This plan explicitly authorises adding ~12–14 lines (one import line, one `useMemo`, one prop on one JSX element). The implementer is forbidden by `CODING_STANDARDS.md` Section 9.1 from adding anything further. A separate file-split task should be opened as tech debt — but per Section 9.4 "doing it reactively in the middle of unrelated work is how regressions happen", and the split is out of scope here.

5. **Phone combining behaviour.** The plan combines `phoneCountryCode + ' ' + phoneNumber` for the `phone` display variable. There is no E.164 normalisation; this is intentional — the spec says "Candidate's phone number" with no formatting requirements. The combined-string approach is preferable to exposing the two fields separately because that would mean the candidate-facing UI would have to know about phone storage internals.

6. **Replacement-before-sanitization ordering.** Spec Business Rule 2 is explicit: replacement happens BEFORE DOMPurify. This protects against a value that contains `<script>` etc. — DOMPurify cleans the merged content as a single unit. The renderer test must assert this ordering (the implementer note in row 2 above covers it).

7. **`{{unrecognized}}` is replaced with empty string.** This is per spec edge case row 2. A side effect is that a typo in the admin's content (e.g., `{{candidatFirstName}}` missing the 'e') silently disappears at render time. The admin reference panel is the mitigation. A future enhancement could surface a validation warning in the admin UI, but that is out of scope for v1.

8. **No `inviteLink` in the workflow-section variable list.** A candidate viewing a workflow section has already clicked the invite link. Surfacing `inviteLink` inside section content is not useful and is not in the spec's v1 list. We're not adding it.

9. **Existing renderer test mocks `sanitizeWorkflowContent` as identity.** The implementer must follow the same pattern for `replaceTemplateVariables` — an inline mock that returns its content argument unchanged so the renderer test can assert wiring without re-testing the replacement logic (which has its own dedicated unit tests).

10. **No PII logging.** The structure route already follows the rule; the new code in `portal-layout.tsx` does not log anything. The replacement function itself has no logger calls. This is explicit so the implementer does not "helpfully" add debug logs that would carry PII through values.

11. **Order of `import` statements in the renderer.** Per `CODING_STANDARDS.md` Section 2.3 the new imports must slot into the existing import order groups — `replaceTemplateVariables` is an internal project import (`@/lib/...`) and `TemplateVariableValues` is a type import. The implementer must respect the existing grouping.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above (7 new files + 9 modified files).
- [x] No file outside this plan will need to be modified. The implementer's Rule 6 is satisfied.
- [x] All Zod schemas (none new), types (4 new + 1 modified), and translation keys (8 new keys × 5 locale files) are listed.
- [x] The plan is consistent with the spec's Data Requirements table (field names: `candidateFirstName`, `candidateLastName`, `candidateEmail`, `candidatePhone`, `companyName`, `expirationDate` — exact match).
- [x] The shared replacement function is in a single shared location (`/src/lib/templates/replaceTemplateVariables.ts`).
- [x] The registry is shared between the replacement function and the admin UI reference list (both import from `/src/lib/templates/variableRegistry.ts`).
- [x] Replacement-before-sanitization ordering is explicitly required in the renderer modification and the test addition.
- [x] No database changes (confirmed in the spec's "Data Requirements" section).
- [x] The structure route is the source of the email and phone values, and the test for that route is in the modification list.
- [x] Date formatting (`dd MMM yyyy`) uses `date-fns`, which is already a project dependency.

---

**Plan is ready for the test-writer to proceed.**
