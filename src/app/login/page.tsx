// src/app/login/page.tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';
import { LanguageSelector } from '@/components/layout/language-selector';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your account',
};

export default async function LoginPage() {
  // If the user is already logged in, redirect to the homepage
  const session = await auth();
  if (session) {
    redirect('/');
  }

  return (
    <div className="centered-container">
      {/* Language selector positioned in the top-right corner */}
      <div className="relative w-full">
        <div className="absolute top-6 right-6">
          <LanguageSelector />
        </div>
        
        {/* Login form with content-section class for consistent padding */}
        <div className="content-section flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}