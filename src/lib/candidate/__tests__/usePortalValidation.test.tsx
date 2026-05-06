// /GlobalRX_v2/src/lib/candidate/__tests__/usePortalValidation.test.tsx
//
// Phase 7 Stage 1 — Pass 2 hook tests for usePortalValidation.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 1, 2, 3, 8, 11, 34; DoD 1, 2, 18, 23)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §5.4a
//
// Per Mocking Rule M2 the sectionVisitTracking helpers are NOT mocked — the
// hook delegates to them and the tests assert on the merged-state output.
// Per Mocking Rule M1 the hook itself is the subject and is not mocked.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { usePortalValidation } from '../usePortalValidation';

// Mock client-logger so warn/error calls during fetch failure paths are
// deterministic and don't print to the test console.
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// fetch mock — typed inline implementation that reads URL + method + body.
// This is NOT a scripted return per Rule M3: the mock inspects the request
// and returns deterministic shape based on the URL it receives. If the hook
// stops calling validate or stops POSTing, the mock won't be exercised and
// the test assertions on call counts will fail.
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  // Default: every fetch resolves to a 200 OK with an empty validation result.
  fetchMock.mockImplementation(
    async (url: string | URL, init?: RequestInit) => {
      const urlString = url.toString();
      if (urlString.includes('/validate')) {
        return new Response(
          JSON.stringify({
            sections: [],
            summary: { sections: [], allComplete: true, totalErrors: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (urlString.includes('/save')) {
        return new Response(
          JSON.stringify({ success: true, savedAt: '2026-05-06T12:00:00Z' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    },
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePortalValidation', () => {
  describe('initialization', () => {
    it('seeds state from initial props', () => {
      const { result } = renderHook(() =>
        usePortalValidation({
          token: 'tok-123',
          initialSectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: '2026-05-06T10:30:00Z',
            },
          },
          initialReviewPageVisitedAt: '2026-05-06T11:00:00Z',
        }),
      );

      expect(result.current.sectionVisits).toEqual({
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z',
        },
      });
      expect(result.current.reviewPageVisitedAt).toBe('2026-05-06T11:00:00Z');
    });

    it('defaults to empty visits + null reviewPageVisitedAt when no initial props', () => {
      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      expect(result.current.sectionVisits).toEqual({});
      expect(result.current.reviewPageVisitedAt).toBeNull();
    });

    it('fires an initial /validate fetch on mount', async () => {
      renderHook(() => usePortalValidation({ token: 'tok-123' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      const validateCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/validate'),
      );
      expect(validateCalls.length).toBeGreaterThan(0);
      expect(validateCalls[0][0]).toBe(
        '/api/candidate/application/tok-123/validate',
      );
      expect(validateCalls[0][1]?.method).toBe('POST');
    });

    it('does not fire /validate when paused=true', async () => {
      renderHook(() =>
        usePortalValidation({ token: 'tok-123', paused: true }),
      );

      // Wait a tick so the effect runs.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const validateCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/validate'),
      );
      expect(validateCalls).toHaveLength(0);
    });
  });

  describe('markSectionVisited — Rule 2 (visitedAt set on first visit)', () => {
    it('records a new section visit and POSTs the visit-tracking save', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      // Wait for the initial validate fetch to settle so the test assertions
      // operate on a quiescent fetch mock.
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      fetchMock.mockClear();

      act(() => {
        result.current.markSectionVisited('personal_info');
      });

      // The hook updates state synchronously and posts asynchronously.
      expect(result.current.sectionVisits.personal_info).toBeDefined();
      expect(result.current.sectionVisits.personal_info.departedAt).toBeNull();
      expect(typeof result.current.sectionVisits.personal_info.visitedAt).toBe(
        'string',
      );

      // POST goes to /save with section_visit_tracking type.
      await waitFor(() => {
        const saveCalls = fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes('/save'),
        );
        expect(saveCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(saveCalls[0][1]?.body as string);
        expect(body.sectionType).toBe('section_visit_tracking');
        expect(body.sectionVisits).toEqual([
          {
            sectionId: 'personal_info',
            visitedAt: result.current.sectionVisits.personal_info.visitedAt,
            departedAt: null,
          },
        ]);
      });
    });

    it('does not overwrite the visit when called twice for the same section (Rule 2)', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      act(() => {
        result.current.markSectionVisited('personal_info');
      });
      const firstVisit =
        result.current.sectionVisits.personal_info.visitedAt;

      act(() => {
        result.current.markSectionVisited('personal_info');
      });
      const secondVisit =
        result.current.sectionVisits.personal_info.visitedAt;

      expect(secondVisit).toBe(firstVisit);
    });
  });

  describe('markSectionDeparted — Rule 2 (departedAt one-way) + Rule 8 (refresh validate)', () => {
    it('sets departedAt and refreshes validation', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({
          token: 'tok-123',
          initialSectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: null,
            },
          },
        }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      fetchMock.mockClear();

      act(() => {
        result.current.markSectionDeparted('personal_info');
      });

      expect(
        result.current.sectionVisits.personal_info.departedAt,
      ).not.toBeNull();
      expect(typeof result.current.sectionVisits.personal_info.departedAt).toBe(
        'string',
      );

      // Both /save (visit tracking) and /validate (refresh) should be hit.
      await waitFor(() => {
        const saveCalls = fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes('/save'),
        );
        const validateCalls = fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes('/validate'),
        );
        expect(saveCalls.length).toBeGreaterThan(0);
        expect(validateCalls.length).toBeGreaterThan(0);
      });
    });

    it('is a no-op for a section that has not been visited', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      fetchMock.mockClear();

      act(() => {
        result.current.markSectionDeparted('never_visited_section');
      });

      // No state change.
      expect(
        result.current.sectionVisits.never_visited_section,
      ).toBeUndefined();

      // No save/validate POST fired.
      const postCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).match(/\/(save|validate)$/),
      );
      expect(postCalls).toHaveLength(0);
    });

    it('is a no-op for an already-departed section (Rule 2 — once departed, never un-depart)', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({
          token: 'tok-123',
          initialSectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: '2026-05-06T10:30:00Z',
            },
          },
        }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      fetchMock.mockClear();

      const originalDepartedAt =
        result.current.sectionVisits.personal_info.departedAt;

      act(() => {
        result.current.markSectionDeparted('personal_info');
      });

      // departedAt unchanged.
      expect(result.current.sectionVisits.personal_info.departedAt).toBe(
        originalDepartedAt,
      );
    });
  });

  describe('markReviewVisited — Rule 3 (one-way flag) + Rule 34 (refresh validate)', () => {
    it('sets reviewPageVisitedAt and POSTs the visit-tracking save', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      fetchMock.mockClear();

      act(() => {
        result.current.markReviewVisited();
      });

      expect(result.current.reviewPageVisitedAt).not.toBeNull();
      expect(typeof result.current.reviewPageVisitedAt).toBe('string');

      // POST + validate refresh.
      await waitFor(() => {
        const saveCalls = fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes('/save'),
        );
        const validateCalls = fetchMock.mock.calls.filter((call) =>
          String(call[0]).includes('/validate'),
        );
        expect(saveCalls.length).toBeGreaterThan(0);
        expect(validateCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(saveCalls[0][1]?.body as string);
        expect(body.sectionType).toBe('section_visit_tracking');
        expect(typeof body.reviewPageVisitedAt).toBe('string');
      });
    });

    it('does not POST a second time when called again after first set (Rule 3 — one-way)', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({
          token: 'tok-123',
          initialReviewPageVisitedAt: '2026-05-06T11:00:00Z',
        }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      fetchMock.mockClear();

      act(() => {
        result.current.markReviewVisited();
      });

      // The flag should still be the original (Rule 3 — never reset).
      expect(result.current.reviewPageVisitedAt).toBe('2026-05-06T11:00:00Z');

      // No /save POST should be made on the second mark.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const saveCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/save'),
      );
      expect(saveCalls).toHaveLength(0);
    });
  });

  describe('isErrorVisible — delegates to shouldShowErrorsForSection', () => {
    it('returns false for a never-departed section with no review visit', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      expect(result.current.isErrorVisible('personal_info')).toBe(false);
    });

    it('returns true for a departed section', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({
          token: 'tok-123',
          initialSectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: '2026-05-06T10:30:00Z',
            },
          },
        }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      expect(result.current.isErrorVisible('personal_info')).toBe(true);
    });

    it('returns true for any section once reviewPageVisitedAt is set (Rule 34)', async () => {
      const { result } = renderHook(() =>
        usePortalValidation({
          token: 'tok-123',
          initialReviewPageVisitedAt: '2026-05-06T11:00:00Z',
        }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      expect(result.current.isErrorVisible('never_visited_section')).toBe(true);
      expect(result.current.isErrorVisible('idv')).toBe(true);
    });
  });

  describe('refreshValidation — Rule 35 (always recompute)', () => {
    it('updates validationResult from the /validate response', async () => {
      const customResult = {
        sections: [],
        summary: {
          sections: [
            {
              sectionId: 'personal_info',
              sectionName: 'personal_info',
              status: 'incomplete',
              errors: [],
            },
          ],
          allComplete: false,
          totalErrors: 0,
        },
      };
      fetchMock.mockImplementation(async (url: string | URL) => {
        if (String(url).includes('/validate')) {
          return new Response(JSON.stringify(customResult), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{}', { status: 200 });
      });

      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(result.current.validationResult).not.toBeNull();
      });

      expect(result.current.validationResult).toEqual(customResult);
    });

    it('keeps the last known validation state when /validate returns non-OK (Edge 12 graceful failure)', async () => {
      // First call resolves OK with a known result.
      const goodResult = {
        sections: [],
        summary: {
          sections: [
            {
              sectionId: 'personal_info',
              sectionName: 'personal_info',
              status: 'complete',
              errors: [],
            },
          ],
          allComplete: true,
          totalErrors: 0,
        },
      };
      let callCount = 0;
      fetchMock.mockImplementation(async (url: string | URL) => {
        if (String(url).includes('/validate')) {
          callCount++;
          if (callCount === 1) {
            return new Response(JSON.stringify(goodResult), { status: 200 });
          }
          return new Response('{"error":"server failure"}', { status: 500 });
        }
        return new Response('{}', { status: 200 });
      });

      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(result.current.validationResult).not.toBeNull();
      });
      expect(result.current.validationResult).toEqual(goodResult);

      await act(async () => {
        await result.current.refreshValidation();
      });

      // Last known state retained.
      expect(result.current.validationResult).toEqual(goodResult);
    });

    it('keeps the last known validation state when /validate throws (Edge 12 graceful failure)', async () => {
      const goodResult = {
        sections: [],
        summary: {
          sections: [
            {
              sectionId: 'personal_info',
              sectionName: 'personal_info',
              status: 'complete',
              errors: [],
            },
          ],
          allComplete: true,
          totalErrors: 0,
        },
      };
      let callCount = 0;
      fetchMock.mockImplementation(async (url: string | URL) => {
        if (String(url).includes('/validate')) {
          callCount++;
          if (callCount === 1) {
            return new Response(JSON.stringify(goodResult), { status: 200 });
          }
          throw new Error('Network failure');
        }
        return new Response('{}', { status: 200 });
      });

      const { result } = renderHook(() =>
        usePortalValidation({ token: 'tok-123' }),
      );

      await waitFor(() => {
        expect(result.current.validationResult).not.toBeNull();
      });

      await act(async () => {
        await result.current.refreshValidation();
      });

      expect(result.current.validationResult).toEqual(goodResult);
    });
  });
});
