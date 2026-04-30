// /GlobalRX_v2/src/components/candidate/portal-sidebar.tsx

'use client';

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CandidatePortalSection } from '@/types/candidate-portal';

interface PortalSidebarProps {
  sections: CandidatePortalSection[];
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function PortalSidebar({
  sections,
  activeSection,
  onSectionClick,
  isOpen = true,
  onClose
}: PortalSidebarProps) {
  const { t } = useTranslation();

  const getStatusIcon = (status: CandidatePortalSection['status']) => {
    switch (status) {
      case 'complete':
        return (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'in_progress':
        return (
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        );
      default: // not_started
        return (
          <div className="w-5 h-5 rounded-full bg-gray-300" />
        );
    }
  };

  const getStatusLabel = (status: CandidatePortalSection['status']) => {
    switch (status) {
      case 'complete':
        return t('candidate.portal.sections.complete');
      case 'in_progress':
        return t('candidate.portal.sections.inProgress');
      default:
        return t('candidate.portal.sections.notStarted');
    }
  };

  const sidebarContent = (
    <nav className="px-3 py-6">
      <ul className="space-y-1">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              onClick={() => {
                onSectionClick(section.id);
                if (onClose) onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] rounded-md text-left transition-colors ${
                activeSection === section.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
              // min-h-[44px] ensures mobile touch targets meet accessibility standards
            >
              <span className="flex-1 mr-3">{section.title}</span>
              <div className="flex items-center space-x-2">
                {getStatusIcon(section.status)}
                <span className="sr-only">{getStatusLabel(section.status)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  // Mobile slide-out menu
  if (onClose) {
    return (
      <>
        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={onClose}
          />
        )}

        {/* Slide-out panel */}
        <div
          className={`fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 md:hidden ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('candidate.portal.menu')}
              </h2>
              <button
                onClick={onClose}
                className="p-2 min-h-[44px] min-w-[44px] rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="overflow-y-auto h-full pb-20">
            {sidebarContent}
          </div>
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className="hidden md:block w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
      {sidebarContent}
    </aside>
  );
}