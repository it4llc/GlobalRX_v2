// src/app/style-guide/page.tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { StyleGuideContent } from '@/components/style-guide/style-guide-content';

export const metadata: Metadata = {
  title: 'Style Guide',
  description: 'Visual design language for the GlobalRx platform',
};

export default async function StyleGuidePage() {
  // Make sure user is authenticated to view the style guide
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="mb-10">
        <h1 className="text-3xl font-bold mb-2">GlobalRx Style Guide</h1>
        <p className="text-gray-600">A comprehensive guide to the visual language of the GlobalRx platform</p>
      </header>
      
      <StyleGuideContent />
    </div>
  );
}