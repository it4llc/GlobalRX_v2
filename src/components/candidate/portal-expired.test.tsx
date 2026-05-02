// /GlobalRX_v2/src/components/candidate/portal-expired.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortalExpired from './portal-expired';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} - ${JSON.stringify(params)}`;
      }
      return key;
    }
  })
}));

describe('PortalExpired', () => {
  describe('rendering', () => {
    it('should render expired heading', () => {
      render(<PortalExpired companyName="Acme Corp" />);

      expect(screen.getByText('candidate.portal.expired')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('candidate.portal.expired');
    });

    it('should render expired message with company name', () => {
      render(<PortalExpired companyName="Acme Corp" />);

      expect(screen.getByText(/candidate\.portal\.expiredMessage.*"companyName":"Acme Corp"/))
        .toBeInTheDocument();
    });

    it('should render clock icon', () => {
      render(<PortalExpired companyName="Test Company" />);

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-8', 'h-8', 'text-amber-600');

      // Check for clock icon path (simplified check)
      const path = svg?.querySelector('path');
      expect(path).toHaveAttribute('d');
      expect(path?.getAttribute('d')).toContain('12 8v4l3 3'); // Part of clock icon path
    });

    it('should render amber-colored icon container', () => {
      render(<PortalExpired companyName="Test Company" />);

      const iconContainer = document.querySelector('.bg-amber-100');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass('rounded-full', 'w-16', 'h-16');
    });
  });

  describe('styling', () => {
    it('should have correct card styling', () => {
      const { container } = render(<PortalExpired companyName="Test Company" />);

      // Check for Card component wrapper
      const card = container.querySelector('.w-full.max-w-md');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('mx-auto');
    });

    it('should center content on screen', () => {
      const { container } = render(<PortalExpired companyName="Test Company" />);

      const wrapper = container.querySelector('.min-h-screen');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('bg-gray-50', 'flex', 'items-center', 'justify-center');
    });

    it('should have correct text styling', () => {
      render(<PortalExpired companyName="Test Company" />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('text-2xl', 'font-bold', 'text-gray-900', 'mb-4');

      const message = screen.getByText(/candidate\.portal\.expiredMessage/);
      expect(message).toHaveClass('text-gray-600');
    });

    it('should have responsive padding', () => {
      const { container } = render(<PortalExpired companyName="Test Company" />);

      const card = container.querySelector('[class*="p-6"][class*="md:p-8"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long company names', () => {
      const longCompanyName = 'Very Long Company Name That Might Cause Layout Issues If Not Handled Properly Inc.';

      render(<PortalExpired companyName={longCompanyName} />);

      expect(screen.getByText(new RegExp(longCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
        .toBeInTheDocument();
    });

    it('should handle empty company name', () => {
      render(<PortalExpired companyName="" />);

      expect(screen.getByText(/candidate\.portal\.expiredMessage.*"companyName":""/))
        .toBeInTheDocument();
    });

    it('should handle special characters in company name', () => {
      const specialCompanyName = 'Company & Co. <Test> "Quote" \'Apostrophe\'';

      render(<PortalExpired companyName={specialCompanyName} />);

      // The JSON.stringify in our mock will escape special characters
      expect(screen.getByText(/candidate\.portal\.expiredMessage/))
        .toBeInTheDocument();
    });
  });
});