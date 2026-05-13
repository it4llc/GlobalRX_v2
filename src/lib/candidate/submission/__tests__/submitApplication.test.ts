// /GlobalRX_v2/src/lib/candidate/submission/__tests__/submitApplication.test.ts
//
// Phase 7 Stage 2 — Pass 2 mock-backed tests for submitApplication, the
// transaction orchestrator that turns a draft candidate application into a
// submitted order.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §12
//
// What this file covers (mapped from the prompt):
//   - OrderItem + ServicesFulfillment co-creation in the same transaction
//     with assignedVendorId: null (Spec Rule 10, DoD 12)
//   - OrderData population from saved entries (Spec Rule 11, DoD 13)
//   - OrderStatusHistory record on submission (Spec Rule 14, DoD 16)
//   - ServiceComment creation per item, with template lookup-or-create
//     (Spec Rule 15, DoD 17)
//   - Order status update to 'submitted' lowercase (Spec Rule 13, DoD 15)
//   - CandidateInvitation update (status='completed', completedAt) (Rule 16, DoD 18)
//   - Idempotency check inside the transaction (re-submit throws
//     AlreadySubmittedError) (Spec Rule 18, DoD 21)
//   - Empty order-items still succeeds (Spec Rule/Edge 6, DoD 27)
//   - Comment template lookup-or-create paths
//   - Regression: read 'education' / 'employment' section keys (NOT
//     'service_verification-edu') in submitApplication.readEduEmpSection
//
// Mocking discipline (per .claude/agents/test-writer-2.md):
//   - Rule M1: We do NOT mock submitApplication or AlreadySubmittedError.
//     They are the subject of this file.
//   - Rule M2: We do NOT mock buildOrderSubject / buildOrderDataRows /
//     buildRecord/EduEmp/IdvOrderItemKeys / dedupeOrderItemKeys /
//     normalizeRawScope. They are pure helpers that drive the orchestrator's
//     writes; mocking them would let the orchestrator pass garbage and have
//     the test still pass. Each has its own dedicated Pass 1 unit test file.
//   - Rule M3: Prisma is the global mock from src/test/setup.ts. We use
//     vi.mocked(prisma.<model>.<method>).mockResolvedValueOnce(...) per test
//     to establish the response to a SPECIFIC call — not a scripted return
//     for a meaningful-argument utility function.
//   - Rule M4: No invented exceptions. Where in doubt, helpers stay real.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  AlreadySubmittedError,
  submitApplication,
} from '../submitApplication';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { SERVICE_STATUSES } from '@/constants/service-status';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixture builders — minimal shapes the orchestrator reads inside the
// transaction. Field names match prisma/schema.prisma.
// ---------------------------------------------------------------------------

const TODAY = new Date('2026-05-07T00:00:00.000Z');

interface BuildInvitationOpts {
  status?: string;
  orderStatus?: string;
  formData?: unknown;
  packageServices?: unknown[];
}

/**
 * Build the shape returned by `tx.candidateInvitation.findUnique` inside
 * submitApplication. The orchestrator reads:
 *   id, status, createdBy, firstName/lastName/email/phoneCountryCode/phoneNumber,
 *   formData, order.{id, statusCode}, package.packageServices[].{ scope, service }
 */
function buildInvitation(opts: BuildInvitationOpts = {}): Record<string, unknown> {
  return {
    id: 'inv-123',
    orderId: 'order-123',
    customerId: 'cust-1',
    packageId: 'pkg-1',
    token: 'tok-123',
    firstName: 'Alex',
    lastName: 'Candidate',
    email: 'redacted@example.com',
    phoneCountryCode: '+1',
    phoneNumber: '5551234567',
    status: opts.status ?? INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(TODAY.getTime() + 24 * 60 * 60 * 1000),
    createdAt: TODAY,
    createdBy: 'staff-user-1',
    completedAt: null,
    lastAccessedAt: null,
    updatedAt: TODAY,
    formData: opts.formData ?? { sections: {} },
    order: {
      id: 'order-123',
      statusCode: opts.orderStatus ?? 'draft',
    },
    package: {
      id: 'pkg-1',
      packageServices: opts.packageServices ?? [],
    },
  };
}

/** Build a package_services row with the relations the orchestrator reads. */
function ps(serviceId: string, functionalityType: string, scope: unknown = null) {
  return {
    serviceId,
    scope,
    service: { id: serviceId, functionalityType },
  };
}

/** Build a saved address entry whose address_block carries dates + jurisdiction. */
function addressEntry(opts: {
  entryId: string;
  countryId: string;
  countyId?: string;
  stateId?: string;
  fromDate?: string;
  toDate?: string | null;
  isCurrent?: boolean;
  blockReqId?: string;
}) {
  const blockReqId = opts.blockReqId ?? 'req-address-block';
  return {
    entryId: opts.entryId,
    countryId: opts.countryId,
    entryOrder: 0,
    fields: [
      {
        requirementId: blockReqId,
        value: {
          fromDate: opts.fromDate ?? '2024-01-01',
          toDate: opts.toDate ?? null,
          isCurrent: opts.isCurrent ?? true,
          countryId: opts.countryId,
          countyId: opts.countyId,
          stateId: opts.stateId,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('submitApplication (Pass 2 — orchestrator)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reasonable defaults — every test that hits a write expects these to
    // resolve, and tests that need different shapes override per-test.
    vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValue({
      id: 'tmpl-system',
    } as never);
    vi.mocked(prisma.orderItem.create).mockImplementation(
      // Inline implementation reads the data argument so we can verify the
      // orchestrator passes the right shape, AND returns a unique id per call
      // so the OrderData/ServiceComment loops have a real id to thread.
      ((args: { data: { serviceId: string; locationId: string } }) =>
        Promise.resolve({ id: `oi-${args.data.serviceId}-${args.data.locationId}` })) as never,
    );
    vi.mocked(prisma.servicesFulfillment.create).mockResolvedValue({
      id: 'sf-1',
    } as never);
    vi.mocked(prisma.orderData.createMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.serviceComment.create).mockResolvedValue({ id: 'sc-1' } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({} as never);
    vi.mocked(prisma.orderStatusHistory.create).mockResolvedValue({} as never);
    vi.mocked(prisma.candidateInvitation.update).mockResolvedValue({} as never);
  });

  // -------------------------------------------------------------------------
  // Idempotency — Spec Rule 18 / 20 / DoD 21
  // -------------------------------------------------------------------------

  describe('idempotency inside the transaction', () => {
    it('throws AlreadySubmittedError when the invitation is already completed', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ status: INVITATION_STATUSES.COMPLETED }) as never,
      );

      await expect(
        submitApplication(
          prisma as unknown as Prisma.TransactionClient,
          'inv-123',
          TODAY,
        ),
      ).rejects.toBeInstanceOf(AlreadySubmittedError);

      // No order writes happened.
      expect(prisma.orderItem.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
      expect(prisma.candidateInvitation.update).not.toHaveBeenCalled();
    });

    it('throws AlreadySubmittedError when the order is no longer in draft', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ orderStatus: 'submitted' }) as never,
      );

      await expect(
        submitApplication(
          prisma as unknown as Prisma.TransactionClient,
          'inv-123',
          TODAY,
        ),
      ).rejects.toBeInstanceOf(AlreadySubmittedError);

      expect(prisma.orderItem.create).not.toHaveBeenCalled();
    });

    it('throws a generic Error when the invitation is not found', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      await expect(
        submitApplication(
          prisma as unknown as Prisma.TransactionClient,
          'inv-missing',
          TODAY,
        ),
      ).rejects.toThrow(/Invitation not found/);
    });
  });

  // -------------------------------------------------------------------------
  // Empty package — DoD 27
  // -------------------------------------------------------------------------

  describe('zero order items still succeeds', () => {
    it('succeeds with an empty package, updates the order to submitted, and emits no order items', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ packageServices: [] }) as never,
      );

      const result = await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(result.orderId).toBe('order-123');
      expect(result.orderItemIds).toEqual([]);
      expect(result.orderDataRowCount).toBe(0);

      // No item writes.
      expect(prisma.orderItem.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();

      // Order still moves to submitted.
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: expect.objectContaining({
          statusCode: 'submitted',
          submittedAt: TODAY,
        }),
      });

      // OrderStatusHistory entry written.
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledTimes(1);

      // Invitation moved to completed.
      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: expect.objectContaining({
          status: INVITATION_STATUSES.COMPLETED,
          completedAt: TODAY,
        }),
      });
    });
  });

  // -------------------------------------------------------------------------
  // Order item co-creation with ServicesFulfillment — Spec Rule 10 / DoD 12
  // -------------------------------------------------------------------------

  describe('OrderItem + ServicesFulfillment co-creation', () => {
    it('creates a ServicesFulfillment row alongside every OrderItem with assignedVendorId: null', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-idv-1', 'verification-idv')],
          formData: {
            sections: {
              idv: {
                fields: [
                  { requirementId: 'idv_country', value: 'country-us' },
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      // Exactly one OrderItem for the IDV service.
      expect(prisma.orderItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderItem.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          serviceId: 'svc-idv-1',
          locationId: 'country-us',
          status: SERVICE_STATUSES.SUBMITTED,
        },
        select: { id: true },
      });

      // Exactly one ServicesFulfillment co-created — assignedVendorId null.
      expect(prisma.servicesFulfillment.create).toHaveBeenCalledTimes(1);
      expect(prisma.servicesFulfillment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          orderItemId: 'oi-svc-idv-1-country-us',
          serviceId: 'svc-idv-1',
          locationId: 'country-us',
          assignedVendorId: null,
        },
      });
    });

    it('creates one OrderItem per education entry per education service (Rule 7)', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-edu', 'verification-edu')],
          formData: {
            sections: {
              education: {
                entries: [
                  {
                    entryId: 'edu-1',
                    countryId: 'country-us',
                    entryOrder: 0,
                    fields: [],
                  },
                  {
                    entryId: 'edu-2',
                    countryId: 'country-ca',
                    entryOrder: 1,
                    fields: [],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.orderItem.create).toHaveBeenCalledTimes(2);
      expect(prisma.servicesFulfillment.create).toHaveBeenCalledTimes(2);

      // First call — entry 1 in US.
      expect(prisma.orderItem.create).toHaveBeenNthCalledWith(1, {
        data: {
          orderId: 'order-123',
          serviceId: 'svc-edu',
          locationId: 'country-us',
          status: SERVICE_STATUSES.SUBMITTED,
        },
        select: { id: true },
      });
      // Second call — entry 2 in CA.
      expect(prisma.orderItem.create).toHaveBeenNthCalledWith(2, {
        data: {
          orderId: 'order-123',
          serviceId: 'svc-edu',
          locationId: 'country-ca',
          status: SERVICE_STATUSES.SUBMITTED,
        },
        select: { id: true },
      });
    });

    it('REGRESSION TEST: reads the education section under sectionsData["education"] (NOT "service_verification-edu")', async () => {
      // Bug: submitApplication.ts initially read sections['service_verification-edu'].
      // The save endpoint stores the section under 'education'. Reading the
      // wrong key produced zero edu order items — silent data loss.
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-edu', 'verification-edu')],
          formData: {
            sections: {
              // Saved with the canonical key — only this should be read.
              education: {
                entries: [
                  {
                    entryId: 'edu-1',
                    countryId: 'country-us',
                    entryOrder: 0,
                    fields: [],
                  },
                ],
              },
              // If the regression resurfaces, the orchestrator would read
              // this key instead and create zero items. We provide an empty
              // payload here to make the test fail loudly if that happens.
              'service_verification-edu': { entries: [] },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      // Correct behavior — exactly one edu item from the 'education' section.
      expect(prisma.orderItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderItem.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          serviceId: 'svc-edu',
          locationId: 'country-us',
          status: SERVICE_STATUSES.SUBMITTED,
        },
        select: { id: true },
      });
    });

    it('REGRESSION TEST: reads the employment section under sectionsData["employment"]', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-emp', 'verification-emp')],
          formData: {
            sections: {
              employment: {
                entries: [
                  {
                    entryId: 'emp-1',
                    countryId: 'country-gb',
                    entryOrder: 0,
                    fields: [],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.orderItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderItem.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          serviceId: 'svc-emp',
          locationId: 'country-gb',
          status: SERVICE_STATUSES.SUBMITTED,
        },
        select: { id: true },
      });
    });

    it('creates record-type order items at the resolved jurisdiction (county wins over country when DSX has both)', async () => {
      // DSX has the service available at both county and country. The
      // jurisdiction walk should pick county.
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'svc-rec', locationId: 'county-king' },
        { serviceId: 'svc-rec', locationId: 'country-us' },
      ] as never);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [
            ps('svc-rec', 'record', { scopeType: 'all', scopeValue: null }),
          ],
          formData: {
            sections: {
              address_history: {
                entries: [
                  addressEntry({
                    entryId: 'addr-1',
                    countryId: 'country-us',
                    countyId: 'county-king',
                    isCurrent: true,
                    fromDate: '2024-01-01',
                  }),
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.orderItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderItem.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          serviceId: 'svc-rec',
          locationId: 'county-king', // county wins
          status: SERVICE_STATUSES.SUBMITTED,
        },
        select: { id: true },
      });
    });
  });

  // -------------------------------------------------------------------------
  // OrderData population — Spec Rule 11 / DoD 13
  // -------------------------------------------------------------------------

  describe('OrderData population', () => {
    it('inserts OrderData rows derived from the saved entry fields, keyed to the new orderItemId', async () => {
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        { requirementId: 'req-school-name' },
      ] as never);
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        {
          id: 'req-school-name',
          fieldKey: 'schoolName',
          type: 'field',
          fieldData: { dataType: 'text' },
        },
      ] as never);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-edu', 'verification-edu')],
          formData: {
            sections: {
              education: {
                entries: [
                  {
                    entryId: 'edu-1',
                    countryId: 'country-us',
                    entryOrder: 0,
                    fields: [
                      { requirementId: 'req-school-name', value: 'Harvard' },
                    ],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      const result = await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.orderData.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.orderData.createMany).toHaveBeenCalledWith({
        data: [
          {
            orderItemId: 'oi-svc-edu-country-us',
            fieldName: 'req-school-name',
            fieldValue: 'Harvard',
            fieldType: 'text',
          },
        ],
      });

      expect(result.orderDataRowCount).toBe(1);
    });

    it('skips orderData.createMany when an entry has no field rows', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-edu', 'verification-edu')],
          formData: {
            sections: {
              education: {
                entries: [
                  {
                    entryId: 'edu-1',
                    countryId: 'country-us',
                    entryOrder: 0,
                    fields: [], // No saved fields.
                  },
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      // OrderItem still created, but no createMany call (would be empty array).
      expect(prisma.orderItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderData.createMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // OrderStatusHistory — Spec Rule 14 / DoD 16
  // -------------------------------------------------------------------------

  describe('OrderStatusHistory entry', () => {
    it('writes one OrderStatusHistory row with fromStatus=draft, toStatus=submitted, isAutomatic=true, and the documented notes', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledTimes(1);
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-123',
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedBy: 'staff-user-1',
          isAutomatic: true,
          notes: 'Candidate submitted application',
          eventType: 'status_change',
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // ServiceComment — Spec Rule 15 / DoD 17
  // -------------------------------------------------------------------------

  describe('ServiceComment creation', () => {
    it('creates one ServiceComment per OrderItem with the system template id and the documented finalText', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-idv-1', 'verification-idv')],
          formData: {
            sections: {
              idv: {
                fields: [
                  { requirementId: 'idv_country', value: 'country-us' },
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.serviceComment.create).toHaveBeenCalledTimes(1);
      expect(prisma.serviceComment.create).toHaveBeenCalledWith({
        data: {
          orderItemId: 'oi-svc-idv-1-country-us',
          templateId: 'tmpl-system',
          finalText: 'Order item created from candidate application submission',
          isInternalOnly: false,
          isStatusChange: false,
          createdBy: 'staff-user-1',
        },
      });
    });

    it('creates ServiceComments for every order item when there are multiple', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-edu', 'verification-edu')],
          formData: {
            sections: {
              education: {
                entries: [
                  {
                    entryId: 'edu-1',
                    countryId: 'country-us',
                    entryOrder: 0,
                    fields: [],
                  },
                  {
                    entryId: 'edu-2',
                    countryId: 'country-ca',
                    entryOrder: 1,
                    fields: [],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.serviceComment.create).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Comment template lookup-or-create
  // -------------------------------------------------------------------------

  describe('comment template resolution', () => {
    it('uses the existing System template when one is active', async () => {
      // Already set in beforeEach defaults — make explicit here.
      vi.mocked(prisma.commentTemplate.findFirst)
        .mockReset()
        .mockResolvedValueOnce({ id: 'tmpl-existing' } as never);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-idv-1', 'verification-idv')],
          formData: {
            sections: {
              idv: {
                fields: [{ requirementId: 'idv_country', value: 'country-us' }],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      // ServiceComment used the existing template id.
      expect(prisma.serviceComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ templateId: 'tmpl-existing' }),
        }),
      );
      // Did NOT create a new template — the first findFirst returned a row.
      expect(prisma.commentTemplate.create).not.toHaveBeenCalled();
    });

    it('falls back to the General template when no System template exists', async () => {
      // First findFirst (System) returns null, second (General) returns a row.
      vi.mocked(prisma.commentTemplate.findFirst)
        .mockReset()
        .mockResolvedValueOnce(null) // shortName='System' -> not found
        .mockResolvedValueOnce({ id: 'tmpl-general' } as never); // shortName='General'

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-idv-1', 'verification-idv')],
          formData: {
            sections: {
              idv: {
                fields: [{ requirementId: 'idv_country', value: 'country-us' }],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.serviceComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ templateId: 'tmpl-general' }),
        }),
      );
      expect(prisma.commentTemplate.create).not.toHaveBeenCalled();
    });

    it('creates a System comment template when neither System nor General exists', async () => {
      vi.mocked(prisma.commentTemplate.findFirst)
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
        id: 'tmpl-new-system',
      } as never);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-idv-1', 'verification-idv')],
          formData: {
            sections: {
              idv: {
                fields: [{ requirementId: 'idv_country', value: 'country-us' }],
              },
            },
          },
        }) as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      // A new System template was created with the documented shape.
      expect(prisma.commentTemplate.create).toHaveBeenCalledWith({
        data: {
          shortName: 'System',
          longName: 'System-generated comment',
          templateText: 'System-generated comment',
          isActive: true,
        },
        select: { id: true },
      });

      // ServiceComment uses the freshly created template id.
      expect(prisma.serviceComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ templateId: 'tmpl-new-system' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Order update — Spec Rule 13 / DoD 15
  // -------------------------------------------------------------------------

  describe('Order update to submitted', () => {
    it('updates Order.statusCode to lowercase "submitted" with submittedAt = today', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.order.update).toHaveBeenCalledTimes(1);
      const call = vi.mocked(prisma.order.update).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'order-123' });
      expect(call.data).toMatchObject({
        statusCode: 'submitted', // lowercase per CLAUDE.md
        submittedAt: TODAY,
      });
      // Subject is always set (buildOrderSubject seeds locked fields).
      expect(call.data).toHaveProperty('subject');
    });

    it('writes the locked invitation fields into Order.subject', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      const call = vi.mocked(prisma.order.update).mock.calls[0][0];
      const subject = call.data.subject as Record<string, unknown>;
      expect(subject.firstName).toBe('Alex');
      expect(subject.lastName).toBe('Candidate');
      expect(subject.email).toBe('redacted@example.com');
      expect(subject.phone).toBe('+15551234567');
    });
  });

  // -------------------------------------------------------------------------
  // CandidateInvitation update — Spec Rule 16 / DoD 18
  // -------------------------------------------------------------------------

  describe('CandidateInvitation update', () => {
    it('flips the invitation to status="completed" with completedAt=today', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          status: INVITATION_STATUSES.COMPLETED,
          completedAt: TODAY,
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Return shape
  // -------------------------------------------------------------------------

  describe('return value', () => {
    it('returns { orderId, orderItemIds, orderDataRowCount } reflecting the writes performed', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          packageServices: [ps('svc-idv-1', 'verification-idv')],
          formData: {
            sections: {
              idv: {
                fields: [{ requirementId: 'idv_country', value: 'country-us' }],
              },
            },
          },
        }) as never,
      );

      const result = await submitApplication(
        prisma as unknown as Prisma.TransactionClient,
        'inv-123',
        TODAY,
      );

      expect(result.orderId).toBe('order-123');
      expect(result.orderItemIds).toEqual(['oi-svc-idv-1-country-us']);
      // No DSX requirement lookup in beforeEach defaults => no OrderData rows.
      expect(result.orderDataRowCount).toBe(0);
    });
  });
});
