// /GlobalRX_v2/src/components/orders/__tests__/ServiceStatusList.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceStatusList } from '../ServiceStatusList';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: any) => {
    if (key === 'noServices') return 'No services';
    if (key === 'showMore' && params?.count) return `Show ${params.count} more`;
    if (key === 'showLess') return 'Show less';
    return key;
  }
}));

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('ServiceStatusList', () => {
  describe('Component Rendering', () => {
    it('should render services with proper format: "Service Name - Country - Status"', () => {
      const services = [
        {
          id: 'item-1',
          service: { name: 'Criminal Check' },
          location: { name: 'United States', code: 'US' },
          status: 'Submitted'
        }
      ];

      render(<ServiceStatusList items={services} />);

      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('should display "No services" when items array is empty', () => {
      render(<ServiceStatusList items={[]} />);

      const emptyMessage = screen.getByText('No services');
      expect(emptyMessage).toBeInTheDocument();
      expect(emptyMessage).toHaveClass('text-gray-500');
    });

    it('should display up to 5 services initially', () => {
      const services = Array.from({ length: 8 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      render(<ServiceStatusList items={services} />);

      // First 5 should be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Service ${i}`)).toBeInTheDocument();
      }

      // 6th and beyond should not be visible initially
      expect(screen.queryByText('Service 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Service 7')).not.toBeInTheDocument();
      expect(screen.queryByText('Service 8')).not.toBeInTheDocument();

      // Should show "Show 3 more" link
      expect(screen.getByText('Show 3 more')).toBeInTheDocument();
    });

    it('should display all services when "Show N more" is clicked', async () => {
      const services = Array.from({ length: 7 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      render(<ServiceStatusList items={services} />);

      const showMoreButton = screen.getByText('Show 2 more');
      await userEvent.click(showMoreButton);

      // All services should now be visible
      for (let i = 1; i <= 7; i++) {
        expect(screen.getByText(`Service ${i}`)).toBeInTheDocument();
      }

      // "Show less" link should appear
      expect(screen.getByText('Show less')).toBeInTheDocument();
      expect(screen.queryByText('Show 2 more')).not.toBeInTheDocument();
    });

    it('should collapse to 5 services when "Show less" is clicked', async () => {
      const services = Array.from({ length: 7 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      render(<ServiceStatusList items={services} />);

      // Expand
      await userEvent.click(screen.getByText('Show 2 more'));

      // Collapse
      await userEvent.click(screen.getByText('Show less'));

      // Only first 5 should be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Service ${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByText('Service 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Service 7')).not.toBeInTheDocument();

      // "Show N more" link should reappear
      expect(screen.getByText('Show 2 more')).toBeInTheDocument();
    });
  });

  describe('Status Color Coding', () => {
    const statusColorTestCases = [
      { status: 'Draft', expectedClasses: ['bg-gray-100', 'text-gray-800'], displayText: 'Draft' },
      { status: 'Submitted', expectedClasses: ['bg-blue-100', 'text-blue-800'], displayText: 'Submitted' },
      { status: 'Processing', expectedClasses: ['bg-yellow-100', 'text-yellow-800'], displayText: 'Processing' },
      { status: 'Missing Information', expectedClasses: ['bg-orange-100', 'text-orange-800'], displayText: 'Missing Information' },
      { status: 'Completed', expectedClasses: ['bg-green-100', 'text-green-800'], displayText: 'Completed' },
      { status: 'Cancelled', expectedClasses: ['bg-red-100', 'text-red-800'], displayText: 'Cancelled' },
      { status: 'Cancelled-DNB', expectedClasses: ['bg-red-100', 'text-red-800'], displayText: 'Cancelled-DNB' }
    ];

    statusColorTestCases.forEach(({ status, expectedClasses, displayText }) => {
      it(`should apply correct color classes for "${status}" status`, () => {
        const services = [{
          id: 'item-1',
          service: { name: 'Test Service' },
          location: { name: 'USA', code: 'US' },
          status
        }];

        render(<ServiceStatusList items={services} />);

        const statusBadge = screen.getByText(displayText);
        expectedClasses.forEach(className => {
          expect(statusBadge).toHaveClass(className);
        });
        expect(statusBadge).toHaveClass('inline-flex', 'px-2', 'py-0.5', 'text-xs', 'rounded-full');
      });
    });

    it('should display unknown status with gray coloring as fallback', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Test Service' },
        location: { name: 'USA', code: 'US' },
        status: 'unknown_status'
      }];

      render(<ServiceStatusList items={services} />);

      const statusBadge = screen.getByText('unknown_status');
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-800');
    });
  });

  describe('Country Display', () => {
    it('should display full country name when space allows', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Criminal Check' },
        location: { name: 'United States', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} />);

      expect(screen.getByText('United States')).toBeInTheDocument();
    });

    it('should display country code when preferCountryCode prop is true', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Criminal Check' },
        location: { name: 'United States', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} preferCountryCode={true} />);

      expect(screen.getByText('US')).toBeInTheDocument();
      expect(screen.queryByText('United States')).not.toBeInTheDocument();
    });

    it('should display "Unknown Location" when location name is missing', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Criminal Check' },
        location: { name: null, code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} />);

      const unknownLocation = screen.getByText('Unknown Location');
      expect(unknownLocation).toBeInTheDocument();
      expect(unknownLocation).toHaveClass('italic');
    });
  });

  describe('Service Name Display', () => {
    it('should truncate service names longer than 30 characters', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'This is a very long service name that exceeds thirty characters' },
        location: { name: 'USA', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} />);

      expect(screen.getByText('This is a very long service na...')).toBeInTheDocument();
    });

    it('should display "Unnamed Service" when service name is missing', () => {
      const services = [{
        id: 'item-1',
        service: { name: null },
        location: { name: 'USA', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} />);

      const unnamedService = screen.getByText('Unnamed Service');
      expect(unnamedService).toBeInTheDocument();
      expect(unnamedService).toHaveClass('italic');
    });
  });

  describe('Mobile Responsive Layout', () => {
    beforeEach(() => {
      // Mock matchMedia to return true for mobile queries
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it('should display stacked layout on mobile (< 768px)', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Criminal Check' },
        location: { name: 'United States', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} isMobile={true} />);

      // Service name should be on its own line
      const serviceName = screen.getByText('Criminal Check');
      expect(serviceName.parentElement).toHaveClass('block');

      // Country and status should be together with bullet separator
      expect(screen.getByText('•')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('should display inline layout on desktop (>= 768px)', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const services = [{
        id: 'item-1',
        service: { name: 'Criminal Check' },
        location: { name: 'United States', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} isMobile={false} />);

      // Should have dash separators on desktop
      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    });

    it('should have minimum touch target size for expand/collapse links on mobile', () => {
      const services = Array.from({ length: 7 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      render(<ServiceStatusList items={services} isMobile={true} />);

      const showMoreButton = screen.getByText('Show 2 more');
      const buttonElement = showMoreButton.closest('button') || showMoreButton;

      // Check for minimum touch target size classes (44x44 pixels)
      expect(buttonElement).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });
  });

  describe('Edge Cases', () => {
    it('should handle services with mixed valid and missing data', () => {
      const services = [
        {
          id: 'item-1',
          service: { name: 'Valid Service' },
          location: { name: 'USA', code: 'US' },
          status: 'Completed'
        },
        {
          id: 'item-2',
          service: { name: null },
          location: { name: null, code: null },
          status: 'invalid_status'
        },
        {
          id: 'item-3',
          service: { name: 'This is an extremely long service name that definitely exceeds the thirty character limit' },
          location: { name: 'Canada', code: 'CA' },
          status: 'Processing'
        }
      ];

      render(<ServiceStatusList items={services} />);

      // Valid service
      expect(screen.getByText('Valid Service')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();

      // Invalid service with fallbacks
      expect(screen.getByText('Unnamed Service')).toBeInTheDocument();
      expect(screen.getByText('Unknown Location')).toBeInTheDocument();
      expect(screen.getByText('invalid_status')).toBeInTheDocument();

      // Truncated service
      expect(screen.getByText(/This is an extremely long serv.../)).toBeInTheDocument();
    });

    it('should maintain sorting order when expanding and collapsing', async () => {
      const services = Array.from({ length: 7 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      const { rerender } = render(<ServiceStatusList items={services} />);

      // Expand
      await userEvent.click(screen.getByText('Show 2 more'));

      // Verify order is maintained
      const expandedServices = screen.getAllByText(/Service \d/);
      expect(expandedServices[0]).toHaveTextContent('Service 1');
      expect(expandedServices[6]).toHaveTextContent('Service 7');

      // Collapse
      await userEvent.click(screen.getByText('Show less'));

      // Verify first 5 are still in order
      const collapsedServices = screen.getAllByText(/Service \d/);
      expect(collapsedServices[0]).toHaveTextContent('Service 1');
      expect(collapsedServices[4]).toHaveTextContent('Service 5');
    });

    it('should handle empty location code gracefully', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Test Service' },
        location: { name: 'United States', code: null },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} preferCountryCode={true} />);

      // Should fall back to country name when code is missing
      expect(screen.getByText('United States')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for status badges', () => {
      const services = [{
        id: 'item-1',
        service: { name: 'Criminal Check' },
        location: { name: 'USA', code: 'US' },
        status: 'Submitted'
      }];

      render(<ServiceStatusList items={services} />);

      const statusBadge = screen.getByText('Submitted');
      expect(statusBadge).toHaveAttribute('aria-label', 'Service status: Submitted');
    });

    it('should have accessible expand/collapse buttons', async () => {
      const services = Array.from({ length: 7 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      render(<ServiceStatusList items={services} />);

      const showMoreButton = screen.getByText('Show 2 more');
      expect(showMoreButton).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(showMoreButton);

      const showLessButton = screen.getByText('Show less');
      expect(showLessButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should announce service count to screen readers', () => {
      const services = Array.from({ length: 3 }, (_, i) => ({
        id: `item-${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: 'USA', code: 'US' },
        status: 'Draft'
      }));

      render(<ServiceStatusList items={services} />);

      expect(screen.getByRole('list')).toHaveAttribute('aria-label', '3 services');
    });
  });
});