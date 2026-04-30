// /GlobalRX_v2/src/components/candidate/portal-completed.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortalCompleted from './portal-completed';

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

describe('PortalCompleted', () => {
  describe('rendering', () => {
    it('should render completed heading', () => {
      render(
        <PortalCompleted
          firstName="Sarah"
          companyName="Acme Corp"
        />
      );

      expect(screen.getByText('candidate.portal.completed')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('candidate.portal.completed');
    });

    it('should render completed message with first name and company name', () => {
      render(
        <PortalCompleted
          firstName="Sarah"
          companyName="Acme Corp"
        />
      );

      expect(screen.getByText(/candidate\.portal\.completedMessage.*"firstName":"Sarah".*"companyName":"Acme Corp"/))
        .toBeInTheDocument();
    });

    it('should render success icon', () => {
      render(
        <PortalCompleted
          firstName="John"
          companyName="Test Company"
        />
      );

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-8', 'h-8', 'text-green-600');

      // Check for checkmark icon path
      const path = svg?.querySelector('path');
      expect(path).toHaveAttribute('d');
      expect(path?.getAttribute('d')).toContain('M5 13l4 4L19 7'); // Checkmark path
    });

    it('should render green-colored icon container', () => {
      render(
        <PortalCompleted
          firstName="John"
          companyName="Test Company"
        />
      );

      const iconContainer = document.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass('rounded-full', 'w-16', 'h-16');
    });
  });

  describe('styling', () => {
    it('should have correct card styling', () => {
      const { container } = render(
        <PortalCompleted
          firstName="Jane"
          companyName="Example Inc"
        />
      );

      // Check for Card component wrapper
      const card = container.querySelector('.w-full.max-w-md');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('mx-auto');
    });

    it('should center content on screen', () => {
      const { container } = render(
        <PortalCompleted
          firstName="Jane"
          companyName="Example Inc"
        />
      );

      const wrapper = container.querySelector('.min-h-screen');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('bg-gray-50', 'flex', 'items-center', 'justify-center');
    });

    it('should have correct text styling', () => {
      render(
        <PortalCompleted
          firstName="Jane"
          companyName="Example Inc"
        />
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('text-2xl', 'font-bold', 'text-gray-900', 'mb-4');

      const message = screen.getByText(/candidate\.portal\.completedMessage/);
      expect(message).toHaveClass('text-gray-600');
    });

    it('should have responsive padding', () => {
      const { container } = render(
        <PortalCompleted
          firstName="Jane"
          companyName="Example Inc"
        />
      );

      const card = container.querySelector('[class*="p-6"][class*="md:p-8"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const longFirstName = 'VeryLongFirstNameThatMightCauseLayoutIssues';
      const longCompanyName = 'Very Long Company Name That Spans Multiple Words And Might Cause Issues Inc.';

      render(
        <PortalCompleted
          firstName={longFirstName}
          companyName={longCompanyName}
        />
      );

      expect(screen.getByText(new RegExp(longFirstName)))
        .toBeInTheDocument();
      expect(screen.getByText(new RegExp(longCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
        .toBeInTheDocument();
    });

    it('should handle empty first name', () => {
      render(
        <PortalCompleted
          firstName=""
          companyName="Test Corp"
        />
      );

      expect(screen.getByText(/candidate\.portal\.completedMessage.*"firstName":""/))
        .toBeInTheDocument();
    });

    it('should handle empty company name', () => {
      render(
        <PortalCompleted
          firstName="John"
          companyName=""
        />
      );

      expect(screen.getByText(/candidate\.portal\.completedMessage.*"companyName":""/))
        .toBeInTheDocument();
    });

    it('should handle special characters in names', () => {
      const specialFirstName = 'Sarah-Jane O\'Connor';
      const specialCompanyName = 'Company & Co. "Test" Ltd.';

      render(
        <PortalCompleted
          firstName={specialFirstName}
          companyName={specialCompanyName}
        />
      );

      // The JSON.stringify in our mock will escape special characters
      expect(screen.getByText(/candidate\.portal\.completedMessage/))
        .toBeInTheDocument();
      // Verify the text contains the escaped versions
      expect(screen.getByText(/Sarah-Jane O'Connor/))
        .toBeInTheDocument();
    });

    it('should handle both empty first name and company name', () => {
      render(
        <PortalCompleted
          firstName=""
          companyName=""
        />
      );

      expect(screen.getByText(/candidate\.portal\.completedMessage.*"firstName":"".*"companyName":""/))
        .toBeInTheDocument();
    });
  });
});