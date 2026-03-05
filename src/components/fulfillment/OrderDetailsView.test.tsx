// /GlobalRX_v2/src/components/fulfillment/OrderDetailsView.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderDetailsView } from './OrderDetailsView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn()
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'user-123',
      userType: 'internal',
      permissions: { fulfillment: true }
    }
  }))
}));

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
    locale: 'en-US'
  }))
}));

describe('OrderDetailsView', () => {
  const mockOrder = {
    id: 'order-123',
    orderNumber: '20240301-ABC-0001',
    statusCode: 'processing',
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T14:30:00Z',
    customerId: 'customer-456',
    customer: {
      id: 'customer-456',
      name: 'ACME Corporation',
      code: 'ACME'
    },
    subject: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '555-0123',
      dateOfBirth: '1990-01-15',
      ssn: '***-**-6789'
    },
    items: [
      {
        id: 'item-1',
        service: {
          id: 'service-1',
          name: 'Criminal Background Check',
          category: 'Background'
        },
        location: {
          id: 'location-1',
          name: 'National',
          code2: 'US'
        },
        status: 'pending'
      },
      {
        id: 'item-2',
        service: {
          id: 'service-2',
          name: 'Employment Verification',
          category: 'Verification'
        },
        location: {
          id: 'location-2',
          name: 'Previous Employer',
          code2: null
        },
        status: 'completed'
      }
    ],
    notes: 'Urgent processing required',
    assignedVendor: {
      id: 'vendor-789',
      name: 'Background Check Vendor'
    },
    createdBy: {
      id: 'user-999',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('layout structure', () => {
    it('should render with single column layout', () => {
      render(<OrderDetailsView order={mockOrder} />);

      // Check for main content area (single column)
      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();

      // Should have the order-details-view class
      expect(mainContent).toHaveClass('order-details-view');
    });

    it('should display order number in header', () => {
      render(<OrderDetailsView order={mockOrder} />);

      const orderHeader = screen.getByRole('heading', { level: 1 });
      expect(orderHeader).toHaveTextContent('20240301-ABC-0001');
    });
  });

  describe('subject information display', () => {
    it('should display all subject fields', () => {
      render(<OrderDetailsView order={mockOrder} />);

      // Names are displayed separately
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('555-0123')).toBeInTheDocument();
      expect(screen.getByText('01/15/1990')).toBeInTheDocument();
      expect(screen.getByText('***-**-6789')).toBeInTheDocument();
    });

    it('should display "--" for empty subject fields', () => {
      const orderWithEmptyFields = {
        ...mockOrder,
        subject: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: null,
          phone: null,
          dateOfBirth: '1985-06-20',
          ssn: null
        }
      };

      render(<OrderDetailsView order={orderWithEmptyFields} />);

      // Email and phone should show "--"
      const emailLabel = screen.getByText('Email:');
      const emailValue = emailLabel.nextElementSibling;
      expect(emailValue).toHaveTextContent('--');

      const phoneLabel = screen.getByText('Phone:');
      const phoneValue = phoneLabel.nextElementSibling;
      expect(phoneValue).toHaveTextContent('--');

      const ssnLabel = screen.getByText('SSN:');
      const ssnValue = ssnLabel.nextElementSibling;
      expect(ssnValue).toHaveTextContent('--');
    });
  });

  describe('order items display', () => {
    it('should display all order items', () => {
      render(<OrderDetailsView order={mockOrder} />);

      expect(screen.getByText('Criminal Background Check')).toBeInTheDocument();
      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      expect(screen.getByText('National')).toBeInTheDocument();
      expect(screen.getByText('Previous Employer')).toBeInTheDocument();
    });

    it('should display item status badges', () => {
      render(<OrderDetailsView order={mockOrder} />);

      const pendingBadge = screen.getByText('pending');
      expect(pendingBadge).toHaveClass('status-badge-pending');

      const completedBadge = screen.getByText('completed');
      expect(completedBadge).toHaveClass('status-badge-completed');
    });

    it('should display "--" for items without location', () => {
      const orderWithNoLocation = {
        ...mockOrder,
        items: [
          {
            id: 'item-3',
            service: {
              id: 'service-3',
              name: 'Drug Test',
              category: 'Medical'
            },
            location: null,
            status: 'pending'
          }
        ]
      };

      render(<OrderDetailsView order={orderWithNoLocation} />);

      const locationCell = screen.getByTestId('item-location-item-3');
      expect(locationCell).toHaveTextContent('--');
    });
  });

  describe('customer information display', () => {
    it('should display customer details', () => {
      render(<OrderDetailsView order={mockOrder} />);

      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
      expect(screen.getByText('ACME')).toBeInTheDocument();
    });

    it('should display "--" when customer code is missing', () => {
      const orderWithoutCustomerCode = {
        ...mockOrder,
        customer: {
          ...mockOrder.customer,
          code: null
        }
      };

      render(<OrderDetailsView order={orderWithoutCustomerCode} />);

      const customerCodeLabel = screen.getByText('Customer Code:');
      const customerCodeValue = customerCodeLabel.nextElementSibling;
      expect(customerCodeValue).toHaveTextContent('--');
    });
  });

  // Vendor assignment is displayed in the OrderDetailsSidebar, not in OrderDetailsView

  describe('notes display', () => {
    it('should display order notes', () => {
      render(<OrderDetailsView order={mockOrder} />);

      expect(screen.getByText('Urgent processing required')).toBeInTheDocument();
    });

    it('should display "--" when notes are empty', () => {
      const orderWithoutNotes = {
        ...mockOrder,
        notes: null
      };

      render(<OrderDetailsView order={orderWithoutNotes} />);

      const notesLabel = screen.getByText('Notes:');
      const notesValue = notesLabel.nextElementSibling;
      expect(notesValue).toHaveTextContent('--');
    });
  });

  // Metadata (createdBy, timestamps) is displayed in OrderDetailsSidebar
  // Responsive behavior is handled by the parent page component

  // Loading and error states are handled by the parent page component
});