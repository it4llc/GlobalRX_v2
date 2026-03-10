import { redirect } from 'next/navigation';

export default function PortalPage() {
  // BUG FIX (March 9, 2026): Redirect to unified fulfillment dashboard
  redirect('/fulfillment');
}