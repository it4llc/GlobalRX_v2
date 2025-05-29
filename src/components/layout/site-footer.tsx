// src/components/layout/site-footer.tsx
"use client";

import Link from "next/link";
import { useTranslation } from "@/contexts/TranslationContext";

export function SiteFooter() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Information */}


          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('footer.legal', 'Legal')}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                  {t('footer.terms', 'Terms of Service')}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                  {t('footer.privacy', 'Privacy Policy')}
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-300 hover:text-white transition-colors">
                  {t('footer.cookies', 'Cookie Policy')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-center">
          <p className="text-gray-400">
            &copy; {currentYear} REALi Data Solutions. {t('footer.allRights', 'All rights reserved.')}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {t('footer.version', 'Version')} 1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
}