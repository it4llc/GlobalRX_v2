// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/EntryCountrySelector.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryCountrySelector } from '../EntryCountrySelector';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('EntryCountrySelector', () => {
  const mockCountries = [
    { id: 'us', name: 'United States' },
    { id: 'uk', name: 'United Kingdom' },
    { id: 'ca', name: 'Canada' }
  ];

  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render native select on mobile', () => {
    // Mock mobile viewport
    vi.stubGlobal('innerWidth', 375);

    render(
      <EntryCountrySelector
        value={null}
        onChange={mockOnChange}
        countries={mockCountries}
      />
    );

    // Should render native select element
    const select = screen.getByRole('combobox');
    expect(select.tagName).toBe('SELECT');

    // Should have all countries as options
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4); // placeholder + 3 countries
    expect(options[1]).toHaveTextContent('United States');
    expect(options[2]).toHaveTextContent('United Kingdom');
    expect(options[3]).toHaveTextContent('Canada');
  });

  it('should call onChange when country is selected on mobile', () => {
    // Mock mobile viewport
    vi.stubGlobal('innerWidth', 375);

    render(
      <EntryCountrySelector
        value={null}
        onChange={mockOnChange}
        countries={mockCountries}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'uk' } });

    expect(mockOnChange).toHaveBeenCalledWith('uk');
  });

  it('should render with selected value', () => {
    // Mock desktop viewport
    vi.stubGlobal('innerWidth', 1024);

    render(
      <EntryCountrySelector
        value="ca"
        onChange={mockOnChange}
        countries={mockCountries}
      />
    );

    // Check that Canada is selected (desktop uses shadcn Select)
    const button = screen.getByRole('combobox');
    expect(button).toHaveTextContent('Canada');
  });
});