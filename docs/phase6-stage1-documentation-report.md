# Documentation Report: Phase 6 Stage 1: Core Form Engine, Personal Information & IDV Sections
**Date:** May 1, 2026
**Branch:** feature/phase5-stage3-candidate-portal-shell
**Files Changed (from `git diff dev...HEAD --name-only`):**
- docs/specs/phase5-stage3-candidate-portal-shell-technical-plan.md
- docs/specs/phase5-stage3-candidate-portal-shell.md
- docs/specs/phase6-stage1-form-engine-personal-info-idv-technical-plan.md
- docs/specs/phase6-stage1-form-engine-personal-info-idv.md
- prisma/migrations/20260430114252_add_package_id_to_candidate_invitation/migration.sql
- prisma/migrations/20260430211542_add_candidate_form_data/migration.sql
- prisma/schema.prisma
- scripts/update-invitation-package-ids.ts
- src/app/api/candidate/application/[token]/fields/route.ts
- src/app/api/candidate/application/[token]/personal-info-fields/route.ts
- src/app/api/candidate/application/[token]/save/route.ts
- src/app/api/candidate/application/[token]/saved-data/route.ts
- src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts
- src/app/api/candidate/application/[token]/structure/route.ts
- src/app/api/candidate/auth/signout/__tests__/route.test.ts
- src/app/api/candidate/auth/signout/route.ts
- src/app/candidate/[token]/portal/__tests__/page.test.tsx
- src/app/candidate/[token]/portal/page.tsx
- src/components/candidate/CandidateLandingContent.tsx
- src/components/candidate/LoginForm.tsx
- src/components/candidate/form-engine/AutoSaveIndicator.tsx
- src/components/candidate/form-engine/DynamicFieldRenderer.tsx
- src/components/candidate/form-engine/IdvSection.tsx
- src/components/candidate/form-engine/PersonalInfoSection.tsx
- src/components/candidate/portal-completed.test.tsx
- src/components/candidate/portal-completed.tsx
- src/components/candidate/portal-expired.test.tsx
- src/components/candidate/portal-expired.tsx
- src/components/candidate/portal-header.test.tsx
- src/components/candidate/portal-header.tsx
- src/components/candidate/portal-layout.test.tsx
- src/components/candidate/portal-layout.tsx
- src/components/candidate/portal-sidebar.test.tsx
- src/components/candidate/portal-sidebar.tsx
- src/components/candidate/portal-welcome.test.tsx
- src/components/candidate/portal-welcome.tsx
- src/components/candidate/section-placeholder.test.tsx
- src/components/candidate/section-placeholder.tsx
- src/hooks/useDebounce.ts
- src/lib/services/candidate-invitation.service.ts
- src/lib/services/candidateSession.service.ts
- src/translations/en-GB.json
- src/translations/en-US.json
- src/translations/es-ES.json
- src/translations/es.json
- src/translations/ja-JP.json
- src/types/candidate-portal.ts
- tests/e2e/candidate-form-engine.spec.ts
- tests/e2e/candidate-portal-shell.spec.ts

## Code Comments Added
- File: src/app/api/candidate/application/[token]/save/route.ts
- What added: Explanation of why pre-filled invitation fields (firstName, lastName, email, phone) are filtered from saves - this is a data integrity requirement to ensure the candidate being screened matches the person invited

- File: src/components/candidate/form-engine/IdvSection.tsx
- What added: Explanation of why the IDV section is designed as a self-contained component - to allow future replacement with third-party IDV provider integrations without affecting the rest of the application

## Technical Documentation Updated
- Document: docs/api/candidate-application.md
- Section: New file
- Change: Created comprehensive API documentation for all candidate application endpoints including structure, fields, personal-info-fields, save, and saved-data endpoints with request/response schemas and error codes

## API Documentation
- Endpoint: GET /api/candidate/application/[token]/structure
- Documentation file: docs/api/candidate-application.md
- Change: Documented endpoint that returns section list for candidate portal

- Endpoint: GET /api/candidate/application/[token]/fields
- Documentation file: docs/api/candidate-application.md
- Change: Documented endpoint that returns DSX field requirements for a specific service and country

- Endpoint: GET /api/candidate/application/[token]/personal-info-fields
- Documentation file: docs/api/candidate-application.md
- Change: Documented endpoint that returns personal information fields with locked field support

- Endpoint: POST /api/candidate/application/[token]/save
- Documentation file: docs/api/candidate-application.md
- Change: Documented auto-save endpoint with field locking behavior

- Endpoint: GET /api/candidate/application/[token]/saved-data
- Documentation file: docs/api/candidate-application.md
- Change: Documented endpoint that loads previously saved form data

## Suggestions (NOT applied — for project owner review)
No standards suggestions.

## Audit Relevance
No direct audit relevance.

## Documentation Gaps Identified
None.

## Stage Complete
Documentation pass complete for branch `feature/phase5-stage3-candidate-portal-shell`.