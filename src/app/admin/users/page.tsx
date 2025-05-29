// src/app/admin/users/page.tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { UserAdminContent } from '@/components/modules/user-admin/user-admin-content';

export const metadata: Metadata = {
  title: 'User Administration',
  description: 'Manage user accounts and permissions',
};

export default async function UserAdminPage() {
  // Check if user is authenticated and has permissions
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }
  
  const permissions = session.user.permissions;
  const hasAccess = permissions && Object.keys(permissions).length > 0;
  
  if (!hasAccess) {
    redirect('/');
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Administration</h1>
      </div>
      
      <UserAdminContent />
    </div>
  );
}