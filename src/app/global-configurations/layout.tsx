// src/app/global-configurations/layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import NavLayout from '../nav-layout';
import { useTranslation } from '@/contexts/TranslationContext';
import { PageContent } from '@/components/layout/PageContent';

export default function GlobalConfigurationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  
  const tabs = [
    { 
      name: t('config.tabs.locations'), 
      href: '/global-configurations/locations' 
    },
    { 
      name: t('config.tabs.services'), 
      href: '/global-configurations/services' 
    },
    { 
      name: t('config.tabs.data-rx'), 
      href: '/global-configurations/data-rx' 
    },
    { 
      name: t('config.tabs.dsx'), 
      href: '/global-configurations/dsx' 
    },
    { 
      name: t('config.tabs.translations'), 
      href: '/global-configurations/translations' 
    },
  ];
  
  // Function to handle button click navigation
  const handleTabClick = (href: string) => {
    router.push(href);
  };
  
  return (
    <NavLayout>
      <PageContent>
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-6" data-i18n-key="config.global.title">
            Global Configurations
          </h1>
          
          {/* Tabs as Buttons */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-2">
                {tabs.map((tab) => {
                  const isActive = pathname === tab.href;
                  
                  return (
                    <button
                      key={tab.href}
                      onClick={() => handleTabClick(tab.href)}
                      className={`
                        py-2 px-4 text-center border-b-2 font-medium text-sm
                        ${
                          isActive
                            ? 'border-blue-500 text-blue-600 bg-blue-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }
                        cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 rounded-t-md
                      `}
                    >
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
          
          {/* Page content */}
          <div>{children}</div>
        </div>
      </PageContent>
    </NavLayout>
  );
}