// src/components/client-page.tsx
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Session } from 'next-auth';

export default function ClientPage({ session }: { session: Session | null }) {
  return (
    <div style={{ padding: '24px' }}>
      <h1 className="text-3xl font-bold mb-6">
        GlobalRx Screening Platform
      </h1>
      
      {session ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Module 1: User Admin */}
          <Card>
            <CardHeader>
              <CardTitle>User Administration</CardTitle>
              <CardDescription>Manage users and their permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/users">
                <Button className="w-full">Manage Users</Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Module 2: Global Configs */}
          <Card>
            <CardHeader>
              <CardTitle>Global Configurations</CardTitle>
              <CardDescription>Manage locations, services, DSX, and translations</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/global-configurations/locations">
                <Button className="w-full">Manage Configs</Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Module 3: Customer Configs (Placeholder for now) */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Configurations</CardTitle>
              <CardDescription>Manage customer accounts and service scopes</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
          
          {/* Module 4: Candidate Workflow (Placeholder for now) */}
          <Card>
            <CardHeader>
              <CardTitle>Candidate Workflow</CardTitle>
              <CardDescription>Manage candidate data collection</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Welcome to GlobalRx</CardTitle>
              <CardDescription className="text-center">
                A comprehensive platform for global screening
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <p className="text-center">Please sign in using the button in the header to access the platform.</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-4">About GlobalRx</h2>
        <p className="mb-4">
          GlobalRx is a modular platform used for conducting global screening, providing a comprehensive 
          solution for user administration, configuration management, and candidate workflows.
        </p>
        <p>
          The platform consists of four independent modules: User Admin, Global Configurations, 
          Customer Configurations, and Candidate Workflow, all accessible through a unified interface.
        </p>
      </div>
    </div>
  );
}