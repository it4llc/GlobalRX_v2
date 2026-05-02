// /GlobalRX_v2/src/components/candidate/portal-welcome.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortalWelcome from './portal-welcome';
import type { CandidateInvitationInfo } from '@/types/candidate-portal';

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

describe('PortalWelcome', () => {
  const mockInvitation: CandidateInvitationInfo = {
    firstName: 'Sarah',
    lastName: 'Johnson',
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    companyName: 'Acme Corp'
  };

  describe('rendering', () => {
    it('should render welcome title with first name', () => {
      render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={5}
        />
      );

      expect(screen.getByText(/candidate\.portal\.welcomeTitle.*"firstName":"Sarah"/))
        .toBeInTheDocument();
    });

    it('should render company context with company name', () => {
      render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={5}
        />
      );

      expect(screen.getByText(/candidate\.portal\.companyContext.*"companyName":"Acme Corp"/))
        .toBeInTheDocument();
    });

    it('should render section count', () => {
      render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={5}
        />
      );

      expect(screen.getByText(/candidate\.portal\.sectionCount.*"count":5/))
        .toBeInTheDocument();
    });

    it('should render get started message', () => {
      render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={5}
        />
      );

      expect(screen.getByText('candidate.portal.getStarted'))
        .toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle zero section count', () => {
      render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={0}
        />
      );

      expect(screen.getByText(/candidate\.portal\.sectionCount.*"count":0/))
        .toBeInTheDocument();
    });

    it('should handle very long names', () => {
      const longNameInvitation: CandidateInvitationInfo = {
        ...mockInvitation,
        firstName: 'VeryLongFirstNameThatMightCauseLayoutIssues',
        companyName: 'Very Long Company Name That Spans Multiple Words Inc.'
      };

      render(
        <PortalWelcome
          invitation={longNameInvitation}
          sectionCount={10}
        />
      );

      expect(screen.getByText(/VeryLongFirstNameThatMightCauseLayoutIssues/))
        .toBeInTheDocument();
      expect(screen.getByText(/Very Long Company Name That Spans Multiple Words Inc/))
        .toBeInTheDocument();
    });

    it('should handle large section counts', () => {
      render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={100}
        />
      );

      expect(screen.getByText(/candidate\.portal\.sectionCount.*"count":100/))
        .toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should have correct text styling classes', () => {
      const { container } = render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={5}
        />
      );

      const heading = container.querySelector('h1');
      expect(heading).toHaveClass('text-3xl', 'font-bold', 'text-gray-900');

      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs[0]).toHaveClass('text-lg', 'text-gray-700');
      expect(paragraphs[1]).toHaveClass('text-gray-600');
      expect(paragraphs[2]).toHaveClass('text-gray-600');
    });

    it('should have correct padding', () => {
      const { container } = render(
        <PortalWelcome
          invitation={mockInvitation}
          sectionCount={5}
        />
      );

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('p-8');
    });
  });
});