# Feature Specification: Template Variable System for Workflow Sections
**Spec file:** `docs/specs/template-variable-system.md`
**Date:** May 13, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

Workflow sections (the informational pages a candidate sees during their background check application — like a Welcome page or a Consent notice) currently display static text only. This feature adds support for **template variables** — placeholders like `{{candidateFirstName}}` that automatically get replaced with real data (the candidate's actual first name) when the candidate views the page.

This is the same system that already works in invite email templates. We're extending it so it also works inside workflow section content. Both emails and workflow sections will share the same set of variables and the same replacement logic, so adding a new variable in the future makes it available in both places automatically.

On the admin side (the internal team that writes workflow section content), the content editor will show a reference list of available variables so the team knows exactly what placeholders they can use.

## Who Uses This

**Candidates** — see workflow sections with their personal information filled in automatically. For example, the Welcome page might say "Hi Sarah" instead of showing raw placeholder text. The candidate never sees the variable names — only the replaced values.

**Internal admin team** — when creating or editing workflow section content in the admin UI, they can insert template variables (like `{{candidateFirstName}}`) into the HTML content. A reference list in the editor shows them which variables are available and what each one displays.

## Business Rules

1. Template variables use double curly brace syntax: `{{variableName}}`
2. Variable replacement happens **before** the content is cleaned/sanitized for security — this ensures the replaced values go through the same security cleaning as everything else, so nobody can inject harmful code through a variable value
3. If a variable has no value (for example, the candidate's phone number was never entered), the system displays nothing (a blank) — it must **never** show the raw `{{variableName}}` text to the candidate
4. Any text that looks like a variable (double curly braces around a word) but isn't a recognized variable name is also replaced with blank — again, candidates should never see raw placeholder syntax
5. The variable system is shared between email templates and workflow sections — one set of supported variables, one replacement function, used in both places
6. Variable replacement is read-only and happens at display time — the stored workflow section content in the database is not changed; the `{{variableName}}` placeholders stay in the saved content and get replaced fresh every time the candidate views the page
7. Template variables must not allow any kind of code execution — they are simple text replacement only
8. The admin UI content editor must show the list of available variables so the internal team doesn't have to memorize them
9. The variable insertion helper in the admin UI is a reference/dropdown only — it does not need to auto-insert into the editor (nice to have, but not required for v1)

## Supported Variables (v1)

| Variable Name | What It Displays | Where the Data Comes From |
|---|---|---|
| `{{candidateFirstName}}` | Candidate's first name | `candidate_invitations.firstName` |
| `{{candidateLastName}}` | Candidate's last name | `candidate_invitations.lastName` |
| `{{candidateEmail}}` | Candidate's email address | `candidate_invitations.email` |
| `{{candidatePhone}}` | Candidate's phone number | `candidate_invitations.phone` |
| `{{companyName}}` | The customer's company name | `customers.name` (via the order's customer) |
| `{{expirationDate}}` | When the invite link expires | `candidate_invitations.expiresAt` (formatted as dd MMM yyyy, e.g., "15 Jan 2026") |

## User Flow

### Candidate Experience

1. The candidate clicks their invite link and logs in
2. They land on the first workflow section (e.g., a Welcome page)
3. The system loads the workflow section content from the database (which contains placeholders like `{{candidateFirstName}}`)
4. Before displaying the content, the system replaces every recognized `{{variable}}` with the actual value
5. The replaced content goes through security sanitization (DOMPurify)
6. The candidate sees the final page with their real information filled in — for example: "Hi Sarah, welcome to your background check application for Acme Corp."
7. If any variable had no value, that spot is simply blank — no placeholder text is visible

### Admin Experience (Editing Workflow Section Content)

1. An internal team member opens the workflow section content editor in the admin UI (under Customer Configurations → Workflows → Sections)
2. They write or edit the HTML content for the section
3. A reference panel or dropdown near the editor shows the list of available template variables with descriptions
4. The team member types a variable like `{{candidateFirstName}}` directly into the content where they want it to appear
5. They save the section — the content is stored as-is with the `{{variable}}` placeholders in it
6. When a candidate later views this section, the variables get replaced with real data

## Data Requirements

No new database fields are needed. This feature uses existing data from the `candidate_invitations` and `customers` tables.

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| — (not a form field) | candidateFirstName | text (template variable) | — | — | blank if missing |
| — (not a form field) | candidateLastName | text (template variable) | — | — | blank if missing |
| — (not a form field) | candidateEmail | text (template variable) | — | — | blank if missing |
| — (not a form field) | candidatePhone | text (template variable) | — | — | blank if missing |
| — (not a form field) | companyName | text (template variable) | — | — | blank if missing |
| — (not a form field) | expirationDate | text (template variable) | — | — | blank if missing |

## What Needs to Be Built

### 1. Shared Variable Replacement Function

A single function that takes two inputs: (1) a string of content that may contain `{{variable}}` placeholders, and (2) an object containing the actual values. It returns the content with all recognized variables replaced with their values, and any unrecognized variables replaced with blank.

This function must live in a shared location so both email template sending and workflow section rendering use the exact same code. The architect must investigate the existing email template replacement code and consolidate it into this shared function — one set of code, consistent behavior everywhere.

### 2. Variable Registry (List of Supported Variables)

A central list that defines all supported variables — their names, descriptions, and which category they belong to (candidate info, company info, etc.). This list is used by:
- The replacement function (to know which variables are valid)
- The admin UI (to show the available variables to the internal team)

### 3. Update WorkflowSectionRenderer

The existing `WorkflowSectionRenderer.tsx` component currently takes section content and renders it as HTML after running it through DOMPurify for security. It needs to be updated to:
- Accept the variable values as input (candidate name, company name, etc.)
- Run the variable replacement function on the content **before** passing it to DOMPurify
- Then render the sanitized result as it does today

### 4. Pass Variable Data to the Renderer

The parent component that uses `WorkflowSectionRenderer` needs to gather the variable values (from the candidate invitation data and customer data that's already available in the application context) and pass them down to the renderer.

### 5. Admin UI — Variable Reference in Content Editor

The workflow section content editor in the admin UI needs a visible reference showing the available template variables. This could be a collapsible panel, a dropdown button, or a simple reference table near the editor. It should show each variable name and a short description of what it displays.

## Edge Cases and Error Scenarios

| Scenario | What Should Happen |
|---|---|
| Variable has no value (e.g., phone number was never provided) | Display blank — no visible text where the variable was |
| Unrecognized variable name (e.g., `{{someRandomThing}}`) | Display blank — do not show the raw placeholder to the candidate |
| Malformed syntax (e.g., `{{candidateFirstName}` with only one closing brace) | Leave as-is — the pattern only matches proper `{{...}}` syntax, so partial syntax is treated as regular text and goes through normal sanitization |
| Variable value contains HTML or script tags | Safe — the replacement happens before DOMPurify sanitization, so any dangerous content in the values gets cleaned out |
| Content has no variables at all | No problem — the replacement function finds nothing to replace and returns the content unchanged |
| Same variable used multiple times in one section | All occurrences are replaced — the function handles multiple instances |
| Admin types the variable name wrong (e.g., `{{candidatFirstName}}` — missing the 'e') | Treated as an unrecognized variable — replaced with blank. The reference list in the admin UI helps prevent this |
| Database field for the section content is null or empty | Renderer handles this the same as today — shows nothing |

## Impact on Other Modules

**Email templates** — the existing email template variable replacement **must be consolidated** into the new shared function so both email templates and workflow sections use a single set of code. The architect must investigate the existing email template code, then refactor it to use the shared function. This ensures consistent behavior — if a variable is added or a rule changes, it applies everywhere automatically. Emails should work exactly the same as before after the refactor.

**No other modules are affected.** This feature is fully self-contained within the candidate workflow section rendering and the admin workflow section editor.

## Definition of Done

1. A shared variable replacement function exists that both email templates and workflow sections use
2. The function replaces all recognized `{{variableName}}` placeholders with actual values
3. Unrecognized variables are replaced with blank (empty string), not shown as raw text
4. Variables with no value are replaced with blank
5. `WorkflowSectionRenderer` runs variable replacement before DOMPurify sanitization
6. The candidate sees real data (their name, company name, etc.) in workflow sections — not placeholder text
7. The admin workflow section content editor shows a reference list of available variables with descriptions
8. No database schema changes are needed
9. Existing email template variable replacement still works correctly (and now uses the shared function)
10. No raw `{{variableName}}` text is ever visible to a candidate under any circumstance
11. Variable replacement does not allow code execution — it is strictly text-in, text-out
12. The feature works on mobile (320px minimum width) — the rendered content with replaced variables displays correctly on small screens

## Resolved Questions

1. **Consolidate or copy?** — **DECIDED: Consolidate.** The architect must investigate the existing email template variable replacement code first, then produce a single shared function that both email templates and workflow sections use. The goal is one set of code so behavior is consistent everywhere. If the existing email code needs refactoring to become shared, that refactor is part of this task.

2. **Admin UI insertion** — **DECIDED: Reference list only for v1.** A visible list of available variables with descriptions is sufficient. Clipboard copy or auto-insert can be added later.

3. **Date formatting for expirationDate** — **DECIDED: dd MMM yyyy format** (e.g., "15 Jan 2026"). Always English for now since the candidate application is English-only.