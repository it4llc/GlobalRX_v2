# GlobalRx — Tech Debt & Known Issues

This document tracks deferred issues, known limitations, and technical debt
across the GlobalRx platform. Items are logged here when they are identified
but not fixed — usually because the fix is low priority, high churn, or better
handled during a future pass on the affected area.

---

## How to Use This Document

- **Add an item** when a code review, standards check, or dev session identifies
  something that should be fixed but is being intentionally deferred.
- **Remove an item** when it has been resolved — note the fix in the entry before
  deleting it, or move it to the Resolved section at the bottom.
- **Reference this doc** at the start of any work on an affected area so the
  issue can be addressed at the right time.

---

## Open Items

---

### TD-001 — Hardcoded Text Strings in Fulfillment ID Standardization Files

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Fulfillment / Service APIs & Components     |
| Severity    | Warning                                     |
| Identified  | March 18, 2026 - Fulfillment ID Standardization Stage 6 |
| Identified by | Standards Checker                         |

**Description:**
Several files in the fulfillment ID standardization feature contain hardcoded
text strings that should be externalized to the translation system using
the `t()` function from `@/contexts/TranslationContext`.

**Why deferred:**
Fixing this would require updating all related test mocks, resulting in high
churn for low value at this stage of development. The functionality works
correctly with the hardcoded strings, and internationalization is not a
current priority.

**When to fix:**
Address during a future iteration when the affected components are being
worked on for another reason, or when internationalization becomes a priority.

**Files affected:**
- `src/components/services/ServiceResultsSection.tsx` - Multiple hardcoded strings including:
  - "Invalid service ID format"
  - "Failed to load service data"
  - "Service is in terminal status and cannot be edited"
  - "Results saved successfully"
  - "Only PDF files are allowed"
  - "File size must be 5MB or less"
  - "File uploaded successfully"
  - "Attachment deleted successfully"
  - "Loading results..."
  - "Search Results" (label)
  - "Enter search results and findings..." (placeholder)
  - "Added by" / "Last modified by" metadata text
  - Button text: "Save", "Saving...", "Cancel", "Upload PDF", "Uploading..."
  - "No attachments"
  - "Delete Attachment" (dialog title)
  - "Are you sure you want to delete this attachment? This action cannot be undone."

**Note:** ServiceCommentSection.tsx already properly uses the translation system,
serving as a good reference implementation when this tech debt is addressed.

---

## Resolved Items

_(Move items here when fixed, with a note on how they were resolved)_

---
