'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  HomeIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect if not a customer user
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.userType !== 'customer') {
      router.push('/login');
    }
  }, [session, status, router]);

  const navigation = [
    { name: 'Dashboard', href: '/portal/dashboard', icon: HomeIcon },
    { name: 'New Order', href: '/portal/orders/new', icon: ShoppingCartIcon },
    { name: 'My Orders', href: '/portal/orders', icon: DocumentTextIcon },
    { name: 'Profile', href: '/portal/profile', icon: UserCircleIcon },
  ];

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  if (!session || session.user.userType !== 'customer') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-brand-blue">
                GlobalRx Portal
              </h1>
              {session.user.customerName && (
                <span className="ml-4 text-sm text-gray-600">
                  {session.user.customerName}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session.user.name || session.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)]">
          <div className="px-4 py-6">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-blue text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}