// src/app/page.tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import NavLayout from './nav-layout';
import { HomepageContent } from '@/components/homepage/homepage-content';
import { PageContent } from '@/components/layout/PageContent';

export const metadata: Metadata = {
  title: 'Home',
};

export default async function HomePage() {
  const session = await auth();

  // Redirect vendor and customer users to fulfillment page
  // BUG FIX (March 9, 2026): All user types now route to unified fulfillment dashboard
  // This ensures consistent user experience and prevents navigation confusion.
  // Previously different user types had different landing pages, causing inconsistent UX.
  if (session?.user?.userType === 'vendor') {
    redirect('/fulfillment');
  } else if (session?.user?.userType === 'customer') {
    redirect('/fulfillment');
  }

  return (
    <NavLayout>
      <PageContent>
        <HomepageContent session={session} />
      </PageContent>
    </NavLayout>
  );
}