// src/app/page.tsx
import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import NavLayout from './nav-layout';
import { HomepageContent } from '@/components/homepage/homepage-content';
import { PageContent } from '@/components/layout/PageContent';

export const metadata: Metadata = {
  title: 'Home',
};

export default async function HomePage() {
  const session = await auth();
  
  return (
    <NavLayout>
      <PageContent>
        <HomepageContent session={session} />
      </PageContent>
    </NavLayout>
  );
}