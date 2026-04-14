// /GlobalRX_v2/src/lib/utils/activity-comparison.ts

/**
 * Utility function to determine if an order or item has new activity
 * since the user last viewed it.
 *
 * Business Rule:
 * - Show indicator if activity timestamp is more recent than view timestamp
 * - Show indicator if user has never viewed (no view record exists)
 * - Never show indicator if there is no activity
 *
 * @param lastActivityAt - The timestamp of the last activity on the order/item
 * @param lastViewedAt - The timestamp when the user last viewed the order/item
 * @returns boolean indicating whether to show the new activity indicator
 */
export function hasNewActivity(
  lastActivityAt: Date | string | null,
  lastViewedAt: Date | string | null | undefined
): boolean {
  // No activity = no indicator
  if (!lastActivityAt) return false;

  // Never viewed = show indicator
  if (!lastViewedAt) return true;

  // Compare timestamps safely by converting to milliseconds
  const activityTime = new Date(lastActivityAt).getTime();
  const viewTime = new Date(lastViewedAt).getTime();

  // Show indicator only if activity is more recent than last view
  return activityTime > viewTime;
}