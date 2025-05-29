'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { AlertBox } from '@/components/ui/alert-box';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  permissions: any;
  createdAt: string;
}

export default function CustomerUsersPage() {
  const { id: customerId } = useParams();
  const { fetchWithAuth, checkPermission } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManageUsers = checkPermission('customers', 'edit') || checkPermission('admin');

  useEffect(() => {
    fetchCustomerUsers();
  }, [customerId]);

  const fetchCustomerUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchWithAuth(`/api/customers/${customerId}/users`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const hasCustomerAccess = (user: User): boolean => {
    // Check if user has access to this specific customer
    const customerPermissions = user.permissions?.customers;
    
    if (!customerPermissions) return false;
    
    // Admin has access to all
    if (user.permissions?.admin === true) return true;
    
    // Check array-based permissions (["*"] or specific customer IDs)
    if (Array.isArray(customerPermissions)) {
      return customerPermissions.includes('*') || customerPermissions.includes(customerId);
    }
    
    // Check object-based permissions
    if (typeof customerPermissions === 'object') {
      return customerPermissions.view === true || 
             customerPermissions.edit === true ||
             customerPermissions[customerId] === true;
    }
    
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center my-12">
        <LoadingIndicator />
      </div>
    );
  }

  if (error) {
    return (
      <AlertBox
        type="error"
        title="Error Loading Users"
        message={error}
        action={
          <Button onClick={fetchCustomerUsers}>Retry</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {t('module.customerConfig.usersWithAccess')}
        </h2>
        
        {canManageUsers && (
          <Button onClick={() => alert('User management coming soon')}>
            {t('module.customerConfig.manageAccess')}
          </Button>
        )}
      </div>

      {users.length === 0 ? (
        <AlertBox
          type="info"
          title={t('module.customerConfig.noUsers')}
          message={t('module.customerConfig.noUsersDescription')}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.email')}</th>
              <th>{t('module.customerConfig.accessLevel')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const hasAccess = hasCustomerAccess(user);
              const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
              
              return (
                <tr key={user.id}>
                  <td>{fullName}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.permissions?.admin === true ? (
                      <Badge variant="warning">{t('module.userAdmin.role.admin')}</Badge>
                    ) : hasAccess ? (
                      <Badge variant="success">{t('module.customerConfig.hasAccess')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('module.customerConfig.noAccess')}</Badge>
                    )}
                  </td>
                  <td>
                    <Badge variant="success">{t('common.active')}</Badge>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}