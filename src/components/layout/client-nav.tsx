// src/components/layout/client-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession, signOut, signIn } from "next-auth/react";
import { useTranslation } from "@/contexts/TranslationContext";
import { LanguageSelector } from "@/components/layout/language-selector";

export function ClientNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslation();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  return (
    <div style={{ 
      display: 'flex', 
      width: '100%', 
      padding: '16px', 
      borderBottom: '1px solid #e5e7eb',
      boxSizing: 'border-box',
      flexWrap: 'wrap',
      justifyContent: 'space-between'
    }}>
      {/* Left side with Home and username */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        alignItems: 'center',
        flexShrink: 0
      }}>
        <Link href="/">
          <Button 
            variant={isActive("/") && pathname === "/" ? "default" : "outline"}
            size="sm"
          >
            {t('common.home')}
          </Button>
        </Link>
        
        {session && (
          <span style={{ 
            fontSize: '0.875rem', 
            color: '#4b5563', 
            marginLeft: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '200px'
          }}>
            {session.user?.email}
          </span>
        )}
      </div>
      
      {/* Right side with language selector and other navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        flexGrow: 1
      }}>
        {/* Language selector */}
        <LanguageSelector />
        
        {session && (
          <>
            <Link href="/admin/users">
              <Button 
                variant={isActive("/admin/users") ? "default" : "outline"}
                size="sm"
              >
                {t('module.userAdmin.title')}
              </Button>
            </Link>
            
             <Link href="/global-configurations/locations">
              <Button 
                variant={isActive("/global-configurations") ? "default" : "outline"}
                size="sm"
              >
                {t('module.globalConfig.title')}
              </Button>
            </Link>
            
            <Link href="/customer-configs">
              <Button 
                variant={isActive("/customer-configs") ? "default" : "outline"}
                size="sm"
              >
                {t('module.customerConfig.title')}
              </Button>
            </Link>
            
            <Link href="/style-guide">
              <Button 
                variant={isActive("/style-guide") ? "default" : "outline"}
                size="sm"
              >
                {t('common.styleGuide')}
              </Button>
            </Link>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              {t('auth.logout')}
            </Button>
          </>
        )}
        
        {!session && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => signIn()}
          >
            {t('auth.login')}
          </Button>
        )}
      </div>
    </div>
  );
}