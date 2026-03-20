// /GlobalRX_v2/src/types/__tests__/status-casing-verify.test.ts

import { describe, it, expect } from 'vitest';
import { updateServiceStatusSchema, isTerminalStatus } from '../service-fulfillment';

describe('VERIFY: Current schema behavior', () => {
  it('show what the schema actually accepts', () => {
    // Test lowercase
    const lowercaseResult = updateServiceStatusSchema.safeParse({ status: 'submitted' });
    console.log('Lowercase "submitted":', lowercaseResult.success);
    if (!lowercaseResult.success) {
      console.log('Error:', lowercaseResult.error.issues[0]);
    }

    // Test Title Case
    const titleCaseResult = updateServiceStatusSchema.safeParse({ status: 'Submitted' });
    console.log('Title Case "Submitted":', titleCaseResult.success);

    // Test what isTerminalStatus does
    console.log('isTerminalStatus("completed"):', isTerminalStatus('completed'));
    console.log('isTerminalStatus("Completed"):', isTerminalStatus('Completed'));
  });
});