import { describe, it, expect } from 'vitest';
import {
  formatServiceStatus,
  normalizeServiceStatus,
  areStatusesEqual,
  getServiceStatusColor
} from '../status-utils';

describe('Status Utilities', () => {
  describe('formatServiceStatus', () => {
    it('should capitalize single word status', () => {
      expect(formatServiceStatus('draft')).toBe('Draft');
      expect(formatServiceStatus('pending')).toBe('Pending');
      expect(formatServiceStatus('submitted')).toBe('Submitted');
      expect(formatServiceStatus('completed')).toBe('Completed');
      expect(formatServiceStatus('cancelled')).toBe('Cancelled');
    });

    it('should handle underscore-separated words', () => {
      expect(formatServiceStatus('in_progress')).toBe('In Progress');
      expect(formatServiceStatus('pending_review')).toBe('Pending Review');
      expect(formatServiceStatus('more_info_needed')).toBe('More Info Needed');
    });

    it('should handle hyphen-separated words', () => {
      expect(formatServiceStatus('in-progress')).toBe('In Progress');
      expect(formatServiceStatus('pending-review')).toBe('Pending Review');
    });

    it('should handle special cases correctly', () => {
      expect(formatServiceStatus('cancelled_dnb')).toBe('Cancelled-DNB');
      expect(formatServiceStatus('cancelled-dnb')).toBe('Cancelled-DNB');
      expect(formatServiceStatus('missing_info')).toBe('Missing Information');
      expect(formatServiceStatus('missing_information')).toBe('Missing Information');
    });

    it('should handle mixed case input', () => {
      expect(formatServiceStatus('draft')).toBe('Draft');
      expect(formatServiceStatus('In_Progress')).toBe('In Progress');
      expect(formatServiceStatus('cancelled_dnb')).toBe('Cancelled-DNB');
    });

    it('should handle empty, null, and undefined values', () => {
      expect(formatServiceStatus('')).toBe('');
      expect(formatServiceStatus(null)).toBe('');
      expect(formatServiceStatus(undefined)).toBe('');
    });

    it('should handle already formatted status', () => {
      expect(formatServiceStatus('Draft')).toBe('Draft');
      expect(formatServiceStatus('In Progress')).toBe('In Progress');
    });
  });

  describe('normalizeServiceStatus', () => {
    it('should convert to lowercase with underscores', () => {
      expect(normalizeServiceStatus('Draft')).toBe('draft');
      expect(normalizeServiceStatus('In Progress')).toBe('in_progress');
      expect(normalizeServiceStatus('Pending Review')).toBe('pending_review');
      expect(normalizeServiceStatus('CANCELLED-DNB')).toBe('cancelled_dnb');
    });

    it('should handle already normalized values', () => {
      expect(normalizeServiceStatus('draft')).toBe('draft');
      expect(normalizeServiceStatus('in_progress')).toBe('in_progress');
    });

    it('should handle empty, null, and undefined values', () => {
      expect(normalizeServiceStatus('')).toBe('');
      expect(normalizeServiceStatus(null)).toBe('');
      expect(normalizeServiceStatus(undefined)).toBe('');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeServiceStatus('In   Progress')).toBe('in_progress');
      expect(normalizeServiceStatus('  Draft  ')).toBe('draft');
    });
  });

  describe('areStatusesEqual', () => {
    it('should return true for equivalent statuses', () => {
      expect(areStatusesEqual('draft', 'Draft')).toBe(true);
      expect(areStatusesEqual('in_progress', 'In Progress')).toBe(true);
      expect(areStatusesEqual('In-Progress', 'in_progress')).toBe(true);
      expect(areStatusesEqual('cancelled_dnb', 'cancelled-dnb')).toBe(true);
    });

    it('should return false for different statuses', () => {
      expect(areStatusesEqual('draft', 'submitted')).toBe(false);
      expect(areStatusesEqual('pending', 'completed')).toBe(false);
    });

    it('should handle null and undefined values', () => {
      expect(areStatusesEqual(null, null)).toBe(true);
      expect(areStatusesEqual(undefined, undefined)).toBe(true);
      expect(areStatusesEqual('', '')).toBe(true);
      expect(areStatusesEqual('draft', null)).toBe(false);
      expect(areStatusesEqual(null, 'draft')).toBe(false);
    });
  });

  describe('getServiceStatusColor', () => {
    it('should return correct color classes for known statuses', () => {
      expect(getServiceStatusColor('draft')).toBe('bg-gray-100 text-gray-800');
      expect(getServiceStatusColor('Draft')).toBe('bg-gray-100 text-gray-800');

      expect(getServiceStatusColor('pending')).toBe('bg-gray-100 text-gray-800'); // Not recognized, falls to default
      expect(getServiceStatusColor('submitted')).toBe('bg-blue-100 text-blue-800');
      expect(getServiceStatusColor('processing')).toBe('bg-green-50 text-green-600');
      expect(getServiceStatusColor('in_progress')).toBe('bg-gray-100 text-gray-800'); // Not recognized, falls to default

      expect(getServiceStatusColor('pending_review')).toBe('bg-gray-100 text-gray-800'); // Not recognized, falls to default

      expect(getServiceStatusColor('missing_info')).toBe('bg-red-100 text-red-800');
      expect(getServiceStatusColor('Missing Information')).toBe('bg-red-100 text-red-800');

      expect(getServiceStatusColor('completed')).toBe('bg-green-200 text-green-900');

      expect(getServiceStatusColor('cancelled')).toBe('bg-purple-100 text-purple-800');
      expect(getServiceStatusColor('cancelled_dnb')).toBe('bg-purple-100 text-purple-800');
    });

    it('should return default color for unknown statuses', () => {
      expect(getServiceStatusColor('unknown')).toBe('bg-gray-100 text-gray-800');
      expect(getServiceStatusColor('some_other_status')).toBe('bg-gray-100 text-gray-800');
    });

    it('should handle null and undefined values', () => {
      expect(getServiceStatusColor(null)).toBe('bg-gray-100 text-gray-800');
      expect(getServiceStatusColor(undefined)).toBe('bg-gray-100 text-gray-800');
      expect(getServiceStatusColor('')).toBe('bg-gray-100 text-gray-800');
    });
  });
});