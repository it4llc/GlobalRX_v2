// /GlobalRX_v2/src/components/candidate/portal-layout.tsx

'use client';

import React, { useState, useEffect } from 'react';
import PortalHeader from './portal-header';
import PortalSidebar from './portal-sidebar';
import PortalWelcome from './portal-welcome';
import SectionPlaceholder from './section-placeholder';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CandidateInvitationInfo, CandidatePortalSection } from '@/types/candidate-portal';

interface PortalLayoutProps {
  invitation: CandidateInvitationInfo;
  sections: CandidatePortalSection[];
  token: string;
}

export default function PortalLayout({ invitation, sections, token }: PortalLayoutProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const getActiveContent = () => {
    if (!activeSection) {
      return (
        <PortalWelcome
          invitation={invitation}
          sectionCount={sections.length}
        />
      );
    }

    const section = sections.find(s => s.id === activeSection);
    if (!section) {
      return (
        <PortalWelcome
          invitation={invitation}
          sectionCount={sections.length}
        />
      );
    }

    return <SectionPlaceholder title={section.title} />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PortalHeader
        invitation={invitation}
        token={token}
        onMenuToggle={toggleMobileMenu}
        showMenuButton={true}
      />

      {/* Main content area */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop sidebar */}
        <PortalSidebar
          sections={sections}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
        />

        {/* Mobile sidebar */}
        <PortalSidebar
          sections={sections}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
        />

        {/* Content area */}
        <main className="flex-1 bg-white overflow-y-auto">
          {getActiveContent()}
        </main>
      </div>
    </div>
  );
}