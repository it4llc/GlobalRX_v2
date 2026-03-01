// /GlobalRX_v2/src/components/layout/client-nav.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession, signOut, signIn } from "next-auth/react";
import { useTranslation } from "@/contexts/TranslationContext";
import { LanguageSelector } from "@/components/layout/language-selector";
import { ViewToggle } from "@/components/layout/ViewToggle";
import {
  getUserType,
  isInternalUser,
  isVendorUser,
  isCustomerUser,
  canManageUsers,
  canManageCustomers,
  canManageVendors,
  canAccessFulfillment,
  canAccessGlobalConfig,
} from "@/lib/auth-utils";

export function ClientNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslation();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  const user = session?.user || null;

  // Determine the home URL based on user type
  const getHomeUrl = () => {
    const userType = getUserType(user);
    if (userType === 'vendor') return '/fulfillment';
    if (userType === 'customer') return '/portal/dashboard';
    return '/';
  };

  return (
    <div className="flex w-full p-4 border-b border-gray-200 flex-wrap justify-between">
      {/* Left side with Home and username */}
      <div className="flex gap-2 items-center flex-shrink-0">
        <Link href={getHomeUrl()}>
          <Button
            variant={isActive(getHomeUrl()) ? "default" : "outline"}
            size="sm"
          >
            {t('common.home')}
          </Button>
        </Link>
        
        {session && (
          <span className="text-sm text-gray-600 ml-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-48">
            {session.user?.email}
          </span>
        )}
      </div>
      
      {/* Right side with language selector and other navigation */}
      <div className="flex gap-2 flex-wrap justify-end flex-grow">
        {/* View Toggle for internal users with config permissions */}
        {session && (canManageUsers(user) || canAccessGlobalConfig(user)) && (
          <ViewToggle />
        )}

        {/* Language selector */}
        <LanguageSelector />

        {session && (
          <>
            {/* User Admin - only for users with permission */}
            {canManageUsers(user) && (
              <Link href="/admin/users">
                <Button
                  variant={isActive("/admin/users") ? "default" : "outline"}
                  size="sm"
                >
                  {t('module.userAdmin.title')}
                </Button>
              </Link>
            )}

            {/* Global Config - only for users with permission */}
            {canAccessGlobalConfig(user) && (
              <Link href="/global-configurations/locations">
                <Button
                  variant={isActive("/global-configurations") ? "default" : "outline"}
                  size="sm"
                >
                  {t('module.globalConfig.title')}
                </Button>
              </Link>
            )}

            {/* Customer Config - only for users with permission */}
            {canManageCustomers(user) && (
              <Link href="/customer-configs">
                <Button
                  variant={isActive("/customer-configs") ? "default" : "outline"}
                  size="sm"
                >
                  {t('module.customerConfig.title')}
                </Button>
              </Link>
            )}

            {/* Vendor Management - only for users with permission */}
            {canManageVendors(user) && (
              <Link href="/admin/vendors">
                <Button
                  variant={isActive("/admin/vendors") ? "default" : "outline"}
                  size="sm"
                >
                  {t('module.vendorManagement.title')}
                </Button>
              </Link>
            )}

            {/* Orders/Fulfillment - show for users with fulfillment permission */}
            {canAccessFulfillment(user) && (
              <Link href="/fulfillment">
                <Button
                  variant={isActive("/fulfillment") ? "default" : "outline"}
                  size="sm"
                >
                  {t('module.fulfillment.title')}
                </Button>
              </Link>
            )}

            {/* Style Guide - keep for all users (development tool) */}
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