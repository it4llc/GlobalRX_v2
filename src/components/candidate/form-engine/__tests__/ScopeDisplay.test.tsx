// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/ScopeDisplay.test.tsx

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopeDisplay } from '../ScopeDisplay';
import type { ScopeInfo } from '@/types/candidate-repeatable-form';

describe('ScopeDisplay', () => {
  it('should render the scope description for education', () => {
    const scope: ScopeInfo = {
      functionalityType: 'verification-edu',
      serviceId: 'service-123',
      scopeType: 'count_specific',
      scopeValue: 2,
      scopeDescription: 'Please provide your most recent 2 education entries'
    };

    render(<ScopeDisplay scope={scope} />);

    const scopeText = screen.getByText('Please provide your most recent 2 education entries');
    expect(scopeText).toBeInTheDocument();
    expect(scopeText).toHaveClass('text-sm', 'text-blue-800');
  });

  it('should render the scope description for employment', () => {
    const scope: ScopeInfo = {
      functionalityType: 'verification-emp',
      serviceId: 'service-456',
      scopeType: 'time_based',
      scopeValue: 5,
      scopeDescription: 'Please provide all employment for the past 5 years'
    };

    render(<ScopeDisplay scope={scope} />);

    const scopeText = screen.getByText('Please provide all employment for the past 5 years');
    expect(scopeText).toBeInTheDocument();
  });

  it('should render with proper styling classes', () => {
    const scope: ScopeInfo = {
      functionalityType: 'verification-edu',
      serviceId: 'service-789',
      scopeType: 'all',
      scopeValue: null,
      scopeDescription: 'Please provide your complete education history'
    };

    const { container } = render(<ScopeDisplay scope={scope} />);

    const scopeContainer = container.querySelector('.mb-4.p-3.bg-blue-50');
    expect(scopeContainer).toBeInTheDocument();
    expect(scopeContainer).toHaveClass('border', 'border-blue-200', 'rounded-md');
  });
});
