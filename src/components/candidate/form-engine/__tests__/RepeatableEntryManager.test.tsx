// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/RepeatableEntryManager.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepeatableEntryManager } from '../RepeatableEntryManager';
import type { EntryData } from '@/types/candidate-repeatable-form';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'candidate.portal.addEntry') return 'Add Entry';
      if (key === 'candidate.portal.removeEntry') return 'Remove';
      if (key === 'candidate.portal.entryRemoved') return 'Entry removed';
      if (key === 'candidate.portal.educationEntryLabel') return 'Education {number}';
      return key.replace('{number}', '1');
    }
  })
}));

describe('RepeatableEntryManager', () => {
  const mockOnAddEntry = vi.fn();
  const mockOnRemoveEntry = vi.fn();
  const mockOnEntryChange = vi.fn();
  const mockRenderEntry = vi.fn((entry: EntryData, index: number) => (
    <div data-testid={`entry-content-${entry.entryId}`}>
      Entry content for {entry.entryId}
    </div>
  ));

  const mockEntries: EntryData[] = [
    {
      entryId: 'entry-1',
      countryId: 'us',
      entryOrder: 0,
      fields: []
    },
    {
      entryId: 'entry-2',
      countryId: 'uk',
      entryOrder: 1,
      fields: []
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render all entries expanded on desktop', () => {
    // Mock desktop viewport
    vi.stubGlobal('innerWidth', 1024);

    render(
      <RepeatableEntryManager
        entries={mockEntries}
        onAddEntry={mockOnAddEntry}
        onRemoveEntry={mockOnRemoveEntry}
        onEntryChange={mockOnEntryChange}
        renderEntry={mockRenderEntry}
        entryLabelKey="candidate.portal.educationEntryLabel"
      />
    );

    // Both entries should be visible
    expect(screen.getByTestId('entry-content-entry-1')).toBeInTheDocument();
    expect(screen.getByTestId('entry-content-entry-2')).toBeInTheDocument();

    // Should show entry labels
    expect(screen.getByText('Education 1')).toBeInTheDocument();
    expect(screen.getByText('Education 2')).toBeInTheDocument();
  });

  it('should handle adding a new entry', async () => {
    render(
      <RepeatableEntryManager
        entries={mockEntries}
        onAddEntry={mockOnAddEntry}
        onRemoveEntry={mockOnRemoveEntry}
        onEntryChange={mockOnEntryChange}
        renderEntry={mockRenderEntry}
        entryLabelKey="candidate.portal.educationEntryLabel"
      />
    );

    const addButton = screen.getByRole('button', { name: /Add Entry/i });
    await userEvent.click(addButton);

    expect(mockOnAddEntry).toHaveBeenCalledTimes(1);
  });

  it('should handle removing an entry', async () => {
    render(
      <RepeatableEntryManager
        entries={mockEntries}
        onAddEntry={mockOnAddEntry}
        onRemoveEntry={mockOnRemoveEntry}
        onEntryChange={mockOnEntryChange}
        renderEntry={mockRenderEntry}
        entryLabelKey="candidate.portal.educationEntryLabel"
      />
    );

    // Find and click first remove button
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    await userEvent.click(removeButtons[0]);

    expect(mockOnRemoveEntry).toHaveBeenCalledWith('entry-1');

    // Should show remove message
    await waitFor(() => {
      expect(screen.getByText('Entry removed')).toBeInTheDocument();
    });
  });

  it('should debounce rapid add entry clicks', async () => {
    render(
      <RepeatableEntryManager
        entries={mockEntries}
        onAddEntry={mockOnAddEntry}
        onRemoveEntry={mockOnRemoveEntry}
        onEntryChange={mockOnEntryChange}
        renderEntry={mockRenderEntry}
        entryLabelKey="candidate.portal.educationEntryLabel"
      />
    );

    const addButton = screen.getByRole('button', { name: /Add Entry/i });

    // Rapidly click add button
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // Should only call once due to debouncing
    expect(mockOnAddEntry).toHaveBeenCalledTimes(1);
  });

  // Phase 6 Stage 3 additions — minimumEntries and maxEntries.
  describe('minimumEntries (Phase 6 Stage 3)', () => {
    it('hides the remove button when entries.length === minimumEntries', () => {
      const oneEntry: EntryData[] = [
        { entryId: 'only-1', countryId: 'us', entryOrder: 0, fields: [] }
      ];

      render(
        <RepeatableEntryManager
          entries={oneEntry}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          minimumEntries={1}
        />
      );

      // The single entry exists.
      expect(screen.getByTestId('entry-content-only-1')).toBeInTheDocument();
      // No remove button — minimum-one-entry rule.
      expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();
    });

    it('shows remove buttons on each entry when entries.length > minimumEntries', () => {
      // 2 entries, minimum=1 → both should have remove buttons.
      render(
        <RepeatableEntryManager
          entries={mockEntries}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          minimumEntries={1}
        />
      );

      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      expect(removeButtons.length).toBe(2);
    });

    it('default minimumEntries=0 preserves Stage 2 behavior — single entry has remove button', () => {
      const oneEntry: EntryData[] = [
        { entryId: 'only-1', countryId: 'us', entryOrder: 0, fields: [] }
      ];

      render(
        <RepeatableEntryManager
          entries={oneEntry}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          // minimumEntries omitted — defaults to 0
        />
      );

      // The single entry can still be removed.
      expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
    });
  });

  describe('maxEntries (Phase 6 Stage 3)', () => {
    it('hides the Add button when entries.length === maxEntries', () => {
      // 2 entries, max=2 → Add must be hidden.
      render(
        <RepeatableEntryManager
          entries={mockEntries}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          maxEntries={2}
        />
      );

      expect(screen.queryByRole('button', { name: /Add Entry/i })).not.toBeInTheDocument();
    });

    it('hides the Add button when entries.length exceeds maxEntries', () => {
      // 2 entries, max=1 → Add must still be hidden (defensive).
      render(
        <RepeatableEntryManager
          entries={mockEntries}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          maxEntries={1}
        />
      );

      expect(screen.queryByRole('button', { name: /Add Entry/i })).not.toBeInTheDocument();
    });

    it('shows the Add button when entries.length < maxEntries', () => {
      const oneEntry: EntryData[] = [
        { entryId: 'only-1', countryId: 'us', entryOrder: 0, fields: [] }
      ];

      render(
        <RepeatableEntryManager
          entries={oneEntry}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          maxEntries={3}
        />
      );

      expect(screen.getByRole('button', { name: /Add Entry/i })).toBeInTheDocument();
    });

    it('default maxEntries=undefined preserves Stage 2 behavior — Add button always visible', () => {
      // Many entries with no maxEntries — Add stays visible.
      const manyEntries: EntryData[] = [
        { entryId: 'e-a', countryId: 'us', entryOrder: 0, fields: [] },
        { entryId: 'e-b', countryId: 'uk', entryOrder: 1, fields: [] },
        { entryId: 'e-c', countryId: 'ca', entryOrder: 2, fields: [] },
        { entryId: 'e-d', countryId: 'mx', entryOrder: 3, fields: [] }
      ];

      render(
        <RepeatableEntryManager
          entries={manyEntries}
          onAddEntry={mockOnAddEntry}
          onRemoveEntry={mockOnRemoveEntry}
          onEntryChange={mockOnEntryChange}
          renderEntry={mockRenderEntry}
          entryLabelKey="candidate.portal.educationEntryLabel"
          // maxEntries omitted — undefined means unlimited
        />
      );

      expect(screen.getByRole('button', { name: /Add Entry/i })).toBeInTheDocument();
    });
  });
});
