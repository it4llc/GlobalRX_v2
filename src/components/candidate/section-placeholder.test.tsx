// /GlobalRX_v2/src/components/candidate/section-placeholder.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionPlaceholder from './section-placeholder';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('SectionPlaceholder', () => {
  describe('rendering', () => {
    it('should render section title', () => {
      render(<SectionPlaceholder title="Identity Verification" />);

      expect(screen.getByText('Identity Verification')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Identity Verification');
    });

    it('should render placeholder message', () => {
      render(<SectionPlaceholder title="Test Section" />);

      expect(screen.getByText('candidate.portal.sectionPlaceholder')).toBeInTheDocument();
    });

    it('should render placeholder icon', () => {
      render(<SectionPlaceholder title="Test Section" />);

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-16', 'h-16', 'text-gray-400');
    });
  });

  describe('styling', () => {
    it('should have correct heading styles', () => {
      render(<SectionPlaceholder title="Test Section" />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveClass('text-2xl', 'font-semibold', 'text-gray-900', 'mb-4');
    });

    it('should have correct placeholder container styles', () => {
      const { container } = render(<SectionPlaceholder title="Test Section" />);

      const placeholderBox = container.querySelector('.bg-gray-50');
      expect(placeholderBox).toBeInTheDocument();
      expect(placeholderBox).toHaveClass('border', 'border-gray-200', 'rounded-lg', 'p-12', 'text-center');
    });

    it('should have correct message text styles', () => {
      render(<SectionPlaceholder title="Test Section" />);

      const message = screen.getByText('candidate.portal.sectionPlaceholder');
      expect(message).toHaveClass('text-gray-600', 'text-lg');
    });

    it('should have correct wrapper padding', () => {
      const { container } = render(<SectionPlaceholder title="Test Section" />);

      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('p-8');
    });
  });

  describe('edge cases', () => {
    it('should handle very long section titles', () => {
      const longTitle = 'This is a very long section title that might cause layout issues if not handled properly in the component';

      render(<SectionPlaceholder title={longTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle empty title', () => {
      render(<SectionPlaceholder title="" />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('');
    });

    it('should handle special characters in title', () => {
      const specialTitle = 'Section & Form <Data> "Test" \'Quote\'';

      render(<SectionPlaceholder title={specialTitle} />);

      expect(screen.getByText(specialTitle)).toBeInTheDocument();
    });
  });
});