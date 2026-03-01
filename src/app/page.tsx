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

  // Redirect vendor and customer users to their appropriate pages
  if (session?.user?.userType === 'vendor') {
    redirect('/fulfillment');
  } else if (session?.user?.userType === 'customer') {
    redirect('/portal/dashboard');
  }

  return (
    <NavLayout>
      <PageContent>
        <HomepageContent session={session} />
      </PageContent>
    </NavLayout>
  );
}