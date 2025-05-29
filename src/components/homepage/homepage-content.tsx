// src/components/homepage/homepage-content.tsx
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/contexts/TranslationContext';
import { Session } from 'next-auth';

export function HomepageContent({ session }: { session: Session | null }) {
  const { t } = useTranslation();
  
  return (
    <div style={{ padding: '24px' }}>
      <h1 className="text-3xl font-bold mb-6">
        {t('app.title')}
      </h1>
      
      {session ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Module 1: User Admin */}
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle>{t('module.userAdmin.title')}</CardTitle>
              <CardDescription>{t('module.userAdmin.description')}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link href="/admin/users">
                <Button className="w-full">{t('module.userAdmin.button')}</Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Module 2: Global Configs */}
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle>{t('module.globalConfig.title')}</CardTitle>
              <CardDescription>{t('module.globalConfig.description')}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link href="/global-configurations/locations">
                <Button className="w-full">{t('module.globalConfig.button')}</Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Module 3: Customer Configs */}
          <Card className="flex flex-col h-full">
            <CardHeader>
              <CardTitle>{t('module.customerConfig.title')}</CardTitle>
              <CardDescription>{t('module.customerConfig.description')}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link href="/customer-configs">
                <Button className="w-full">{t('module.customerConfig.button')}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{t('app.welcome.title')}</CardTitle>
              <CardDescription className="text-center">
                {t('app.welcome.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <p className="text-center">{t('app.welcome.signin')}</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">{t('app.about.title')}</h2>
        <p className="mb-4">
          {t('app.about.description1')}
        </p>
        <p>
          {t('app.about.description2')}
        </p>
      </div>
    </div>
  );
}