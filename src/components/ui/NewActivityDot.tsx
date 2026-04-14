// /GlobalRX_v2/src/components/ui/NewActivityDot.tsx

'use client';

import * as React from "react"
import { cn } from '@/lib/utils';

interface NewActivityDotProps {
  /** Controls visibility - returns null when false */
  show: boolean;
  /** Accessibility label describing what the indicator represents */
  'aria-label': string;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * NewActivityDot Component
 *
 * Displays a small red dot indicator when there is new activity
 * that the user hasn't viewed yet. Used in dashboard order tables
 * and order detail item lists.
 *
 * Visual Specifications:
 * - 8px diameter filled red circle
 * - Returns null when show is false to avoid conditional rendering in callers
 * - Includes required aria-label for accessibility
 * - Accepts optional className for positioning adjustments
 */
export function NewActivityDot({
  show,
  'aria-label': ariaLabel,
  className
}: NewActivityDotProps): JSX.Element | null {
  if (!show) return null;

  return (
    <span
      className={cn(
        "inline-block w-2 h-2 bg-red-500 rounded-full",
        className
      )}
      aria-label={ariaLabel}
      role="status"
    />
  );
}