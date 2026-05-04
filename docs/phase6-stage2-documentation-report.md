# Documentation Report: Phase 6 Stage 2 — Repeatable Entry Sections (Education & Employment)
**Date:** May 3, 2026
**Branch:** feature/phase6-stage2-repeatable-entries

**Files Changed (against the commit before Stage 2 began, `931761c`):**
- .claude/settings.local.json
- docs/specs/phase6-stage2-repeatable-entries-education-employment-technical-plan.md
- docs/specs/phase6-stage2-repeatable-entries-education-employment.md
- logs/combined.log
- logs/error.log
- src/app/api/candidate/application/[token]/countries/__tests__/route.test.ts
- src/app/api/candidate/application/[token]/countries/route.ts
- src/app/api/candidate/application/[token]/fields/route.ts
- src/app/api/candidate/application/[token]/save/__tests__/repeatable-entries.test.ts
- src/app/api/candidate/application/[token]/save/route.ts
- src/app/api/candidate/application/[token]/saved-data/__tests__/repeatable-entries.test.ts
- src/app/api/candidate/application/[token]/saved-data/route.ts
- src/app/api/candidate/application/[token]/scope/__tests__/route.test.ts
- src/app/api/candidate/application/[token]/scope/route.ts
- src/components/candidate/form-engine/EducationSection.tsx
- src/components/candidate/form-engine/EmploymentSection.tsx
- src/components/candidate/form-engine/EntryCountrySelector.tsx
- src/components/candidate/form-engine/RepeatableEntryManager.tsx
- src/components/candidate/form-engine/ScopeDisplay.tsx
- src/components/candidate/form-engine/__tests__/EducationSection.test.tsx
- src/components/candidate/form-engine/__tests__/EmploymentSection.test.tsx
- src/components/candidate/form-engine/__tests__/EntryCountrySelector.test.tsx
- src/components/candidate/form-engine/__tests__/RepeatableEntryManager.test.tsx
- src/components/candidate/form-engine/__tests__/ScopeDisplay.test.tsx
- src/components/candidate/portal-layout.tsx
- src/schemas/__tests__/repeatable-entries.test.ts
- src/translations/en-GB.json
- src/translations/en-US.json
- src/translations/es-ES.json
- src/translations/es.json
- src/translations/ja-JP.json
- src/types/candidate-portal.ts
- src/types/candidate-repeatable-form.ts

## Code Comments Added

No code comments added — the implementation already carries WHY comments wherever non-obvious decisions are made. Examples already in the diff:

- `RepeatableEntryManager.tsx`: the post-update watch-effect approach for expanding newly added entries on mobile (avoiding stale-closure bug), the resize-listener mount strategy, and the 500ms add-button debounce.
- `EducationSection.tsx` / `EmploymentSection.tsx`: why there is no hardcoded country fallback (UUID requirement on save), why auto-save is not gated on `entries.length > 0`, the `collectionTab` "subject" filter, and the `Date → ISO` coercion before save.
- `EmploymentSection.tsx`: why `currentlyEmployed` / `endDate` field detection uses exact `fieldKey` set membership (localized labels and substring false-positives).
- `save/route.ts`: typed request shapes after Zod validation, the `Prisma.InputJsonValue` cast for `formData`, why the fields array is initialized when undefined, and why the DSXRequirement lookup is wrapped to handle test environments without that mock.
- `saved-data/route.ts`: typed formatted-section shapes and the IDV `countryId` narrowing.
- `fields/route.ts`: why `displayOrder` for location-specific (`dsx_mappings`) requirements is resolved from `service_requirements` instead of a `999` fallback.
- `scope/route.ts`: full mapping from stored `package_services.scope` JSON shapes to response `scopeType` values.
- `countries/route.ts`: why `invitation.id` is logged in place of a non-existent `candidateId` field.

## Technical Documentation Updated

- Document: `docs/api/candidate-application.md`
- Section: New endpoint sections — `GET /api/candidate/application/[token]/countries` and `GET /api/candidate/application/[token]/scope`
- Change: Added request/response shapes for both new endpoints. The scope section includes the mapping table from stored `package_services.scope.type` values to response `scopeType` values.

- Document: `docs/api/candidate-application.md`
- Section: `POST /api/candidate/application/[token]/save`
- Change: Documented the dual request shapes — the existing flat-fields format and the new repeatable-entries format. Noted that repeatable saves are whole-section replacement and that an empty `entries` array clears the section.

- Document: `docs/api/candidate-application.md`
- Section: `GET /api/candidate/application/[token]/saved-data`
- Change: Documented the new `entries`-array shape returned for `education` and `employment` sections, and noted that `personal_info` and `idv` are always present (even when empty) while repeatable sections are only present after the candidate has saved at least one entry.

- Document: `docs/api/candidate-application.md`
- Section: Data Storage
- Change: Extended the `formData` JSON example to show `education` and `employment` sections storing `entries` arrays.

- Document: `docs/features/phase6-stage2-repeatable-entries.md`
- Section: New file
- Change: Created a feature overview describing the new components (`RepeatableEntryManager`, `EducationSection`, `EmploymentSection`, `ScopeDisplay`, `EntryCountrySelector`), the new types in `candidate-repeatable-form.ts`, the API surface backing the feature, and the scope-mapping rules.

## API Documentation

- Endpoint: GET /api/candidate/application/[token]/scope
- Documentation file: docs/api/candidate-application.md
- Change: New endpoint documented — query parameter, response shape, scope-type mapping table, and 400/404 error conditions specific to this endpoint.

- Endpoint: GET /api/candidate/application/[token]/countries
- Documentation file: docs/api/candidate-application.md
- Change: New endpoint documented — response shape and the rationale for returning UUIDs (matches `Country.id` storage).

- Endpoint: POST /api/candidate/application/[token]/save (extended)
- Documentation file: docs/api/candidate-application.md
- Change: Documented the new repeatable-entries request format for `education` and `employment` and the whole-section replacement behavior.

- Endpoint: GET /api/candidate/application/[token]/saved-data (extended)
- Documentation file: docs/api/candidate-application.md
- Change: Documented the new `entries`-array response shape for repeatable sections.

## Suggestions (NOT applied — for project owner review)

No standards suggestions. The patterns introduced (Zod-typed request unions, whole-section replacement for repeatable data, server-rendered scope description strings) all fit within existing API and component standards. No new pattern warrants a standards-document change at this time.

## Audit Relevance

No direct audit relevance.

## Documentation Gaps Identified

None within this branch's scope.

## Stage Complete

Documentation pass complete for branch `feature/phase6-stage2-repeatable-entries`.
