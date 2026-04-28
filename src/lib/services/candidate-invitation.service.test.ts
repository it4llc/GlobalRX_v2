// /GlobalRX_v2/src/lib/services/candidate-invitation.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupByTokenWithCustomer, hasPassword } from './candidate-invitation.service';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { ORDER_EVENT_TYPES } from '@/constants/order-event-type';
import type { CandidateInvitation, Customer } from '@prisma/client';

describe('candidate-invitation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for transaction
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      // Create a mock transaction object with the methods we need
      const tx = {
        candidateInvitation: {
          update: vi.fn()
        },
        orderStatusHistory: {
          create: vi.fn()
        }
      };

      // Execute the callback with our mock transaction
      return callback(tx);
    });
  });

  describe('hasPassword', () => {
    it('should return true when passwordHash exists', () => {
      const invitation = {
        passwordHash: 'hashed_password_value'
      };

      expect(hasPassword(invitation)).toBe(true);
    });

    it('should return false when passwordHash is null', () => {
      const invitation = {
        passwordHash: null
      };

      expect(hasPassword(invitation)).toBe(false);
    });

    it('should return false when passwordHash is empty string', () => {
      const invitation = {
        passwordHash: ''
      };

      expect(hasPassword(invitation)).toBe(false);
    });
  });

  describe('lookupByTokenWithCustomer', () => {
    describe('success cases', () => {
      it('should return invitation with customer data when token exists', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Acme Corp',
          address: '123 Main St',
          contactName: 'John Smith',
          contactEmail: 'john@acme.com',
          contactPhone: '555-1234',
          invoiceTerms: null,
          invoiceContact: null,
          invoiceMethod: null,
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          token: 'test-token',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          passwordHash: null,
          status: INVITATION_STATUSES.SENT,
          previousStatus: null,
          expiresAt: new Date('2027-01-01'),
          createdAt: new Date('2024-01-01'),
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: null,
          updatedAt: new Date('2024-01-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        const result = await lookupByTokenWithCustomer('test-token');

        expect(result).toEqual({
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          status: INVITATION_STATUSES.SENT,
          expiresAt: mockInvitation.expiresAt,
          createdAt: mockInvitation.createdAt,
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: null,
          customerName: 'Acme Corp',
          hasPassword: false
        });
      });

      it('should return null when token does not exist', async () => {
        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(null);

        const result = await lookupByTokenWithCustomer('non-existent-token');

        expect(result).toBeNull();
        expect(prisma.candidateInvitation.findUnique).toHaveBeenCalledWith({
          where: { token: 'non-existent-token' },
          include: { customer: true }
        });
      });

      it('should include customer relation in query', async () => {
        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(null);

        await lookupByTokenWithCustomer('test-token');

        expect(prisma.candidateInvitation.findUnique).toHaveBeenCalledWith({
          where: { token: 'test-token' },
          include: { customer: true }
        });
      });

      it('should correctly identify when password exists', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Acme Corp',
          address: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          invoiceTerms: null,
          invoiceContact: null,
          invoiceMethod: null,
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          token: 'test-token',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          passwordHash: 'hashed_password',
          status: INVITATION_STATUSES.ACCESSED,
          previousStatus: null,
          expiresAt: new Date('2027-01-01'),
          createdAt: new Date('2024-01-01'),
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: new Date('2024-06-01'),
          updatedAt: new Date('2024-06-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        const result = await lookupByTokenWithCustomer('test-token');

        expect(result?.hasPassword).toBe(true);
      });
    });

    describe('expiration handling', () => {
      it('should update status to expired when invitation has expired', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Acme Corp',
          address: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          invoiceTerms: null,
          invoiceContact: null,
          invoiceMethod: null,
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const expiredDate = new Date('2024-01-01'); // Past date
        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          token: 'test-token',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          passwordHash: null,
          status: INVITATION_STATUSES.SENT,
          previousStatus: null,
          expiresAt: expiredDate,
          createdAt: new Date('2023-12-01'),
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: null,
          updatedAt: new Date('2023-12-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        let capturedUpdateData: any;
        let capturedHistoryData: any;
        const mockTransaction = vi.fn(async (callback) => {
          const tx = {
            candidateInvitation: {
              update: vi.fn().mockImplementation((args) => {
                capturedUpdateData = args.data;
                return Promise.resolve({
                  ...mockInvitation,
                  ...args.data
                });
              })
            },
            orderStatusHistory: {
              create: vi.fn().mockImplementation((args) => {
                capturedHistoryData = args.data;
                return Promise.resolve({ id: 'history-1' });
              })
            }
          };
          return await callback(tx);
        });

        vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

        const result = await lookupByTokenWithCustomer('test-token');

        // Should return invitation with expired status
        expect(result?.status).toBe(INVITATION_STATUSES.EXPIRED);

        // Should have saved previous status
        expect(capturedUpdateData.previousStatus).toBe(INVITATION_STATUSES.SENT);
        expect(capturedUpdateData.status).toBe(INVITATION_STATUSES.EXPIRED);

        // Should have logged expiration event
        expect(capturedHistoryData.eventType).toBe(ORDER_EVENT_TYPES.INVITATION_EXPIRED);
        expect(capturedHistoryData.message).toBe('Invitation has expired');
        expect(capturedHistoryData.isAutomatic).toBe(true);
      });

      it('should not update status if already marked as expired', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Acme Corp',
          address: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          invoiceTerms: null,
          invoiceContact: null,
          invoiceMethod: null,
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const expiredDate = new Date('2024-01-01'); // Past date
        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          token: 'test-token',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          passwordHash: null,
          status: INVITATION_STATUSES.EXPIRED,
          previousStatus: INVITATION_STATUSES.SENT,
          expiresAt: expiredDate,
          createdAt: new Date('2023-12-01'),
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: null,
          updatedAt: new Date('2024-01-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        const result = await lookupByTokenWithCustomer('test-token');

        // Should return expired status
        expect(result?.status).toBe(INVITATION_STATUSES.EXPIRED);

        // Should not have triggered transaction
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should not update status if invitation has not expired', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Acme Corp',
          address: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          invoiceTerms: null,
          invoiceContact: null,
          invoiceMethod: null,
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const futureDate = new Date('2027-12-31'); // Future date
        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          token: 'test-token',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          passwordHash: null,
          status: INVITATION_STATUSES.SENT,
          previousStatus: null,
          expiresAt: futureDate,
          createdAt: new Date('2024-01-01'),
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: null,
          updatedAt: new Date('2024-01-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        const result = await lookupByTokenWithCustomer('test-token');

        // Should return original status
        expect(result?.status).toBe(INVITATION_STATUSES.SENT);

        // Should not have triggered transaction
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('data transformation', () => {
      it('should include all required fields in response', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Test Company',
          address: '456 Test Ave',
          contactName: 'Test Contact',
          contactEmail: 'contact@test.com',
          contactPhone: '555-9999',
          invoiceTerms: 'Net 30',
          invoiceContact: 'billing@test.com',
          invoiceMethod: 'email',
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-123',
          orderId: 'order-456',
          customerId: 'customer-1',
          token: 'unique-token',
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah@example.com',
          phoneCountryCode: '+44',
          phoneNumber: '7911123456',
          passwordHash: 'hashed_value',
          status: INVITATION_STATUSES.ACCESSED,
          previousStatus: INVITATION_STATUSES.SENT,
          expiresAt: new Date('2027-06-01'),
          createdAt: new Date('2024-01-15'),
          createdBy: 'user-789',
          completedAt: null,
          lastAccessedAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        const result = await lookupByTokenWithCustomer('unique-token');

        expect(result).toEqual({
          id: 'inv-123',
          orderId: 'order-456',
          customerId: 'customer-1',
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah@example.com',
          phoneCountryCode: '+44',
          phoneNumber: '7911123456',
          status: INVITATION_STATUSES.ACCESSED,
          expiresAt: mockInvitation.expiresAt,
          createdAt: mockInvitation.createdAt,
          createdBy: 'user-789',
          completedAt: null,
          lastAccessedAt: mockInvitation.lastAccessedAt,
          customerName: 'Test Company',
          hasPassword: true
        });
      });

      it('should handle null optional fields correctly', async () => {
        const mockCustomer: Customer = {
          id: 'customer-1',
          name: 'Minimal Corp',
          address: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          invoiceTerms: null,
          invoiceContact: null,
          invoiceMethod: null,
          disabled: false,
          allowedServices: null,
          masterAccountId: null,
          billingAccountId: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contractDetails: null
        };

        const mockInvitation: CandidateInvitation & { customer: Customer } = {
          id: 'inv-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          token: 'test-token',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneCountryCode: null,
          phoneNumber: null,
          passwordHash: null,
          status: INVITATION_STATUSES.SENT,
          previousStatus: null,
          expiresAt: new Date('2027-01-01'),
          createdAt: new Date('2024-01-01'),
          createdBy: 'user-1',
          completedAt: null,
          lastAccessedAt: null,
          updatedAt: new Date('2024-01-01'),
          customer: mockCustomer
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

        const result = await lookupByTokenWithCustomer('test-token');

        expect(result?.phoneCountryCode).toBeNull();
        expect(result?.phoneNumber).toBeNull();
        expect(result?.completedAt).toBeNull();
        expect(result?.lastAccessedAt).toBeNull();
        expect(result?.hasPassword).toBe(false);
      });
    });
  });
});