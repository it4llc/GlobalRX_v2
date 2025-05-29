// src/components/modules/global-config/global-config-content.tsx
'use client';

import { useState } from 'react';
import { LocationsTab } from './locations/locations-tab';
import { ServicesTab } from '@/components/modules/global-config/tabs/services-tab';
import { DataRxTab } from '@/components/modules/global-config/tabs/data-rx-tab';
import { DSXTab } from '@/components/modules/global-config/tabs/dsx-tab';
import { useTranslation } from '@/contexts/TranslationContext';
import Link from 'next/link';

export function GlobalConfigContent() {
  const [activeTab, setActiveTab] = useState('locations');
  const [showDebug, setShowDebug] = useState(false);
  const { t } = useTranslation();

  const tabs = [
    { id: 'locations', label: 'config.tabs.locations' },
    { id: 'services', label: 'config.tabs.services' },
    { id: 'data-rx', label: 'config.tabs.data-rx' },
    { id: 'dsx', label: 'config.tabs.dsx' },
    { id: 'translations', label: 'config.tabs.translations' },
  ];

  return (
    <div>
      {/* Debug button */}
      {showDebug && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-xs overflow-auto">
          <p>Current tab: {activeTab}</p>
        </div>
      )}
      
      {/* Tabs navigation with direct class names */}
      <div className="config-tab-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`config-tab-button ${activeTab === tab.id ? 'config-tab-active' : ''}`}
          >
            {t(tab.label) || tab.id.charAt(0).toUpperCase() + tab.id.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'locations' && <LocationsTab />}
        {activeTab === 'services' && <ServicesTab />}
        {activeTab === 'data-rx' && <DataRxTab />}
        {activeTab === 'dsx' && <DSXTab />}
        {activeTab === 'translations' && (
          <div>
            <h2 className="text-xl font-semibold mb-4" data-i18n-key="translations.title">
              Translations Management
            </h2>
            <p className="mb-4" data-i18n-key="translations.description">
              Manage translations for all UI elements across the GlobalRx platform.
              Add new languages or edit existing translations.
            </p>
            <div className="my-6">
              <Link 
                href="/global-configurations/translations" 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                {t('config.tabs.translations')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}