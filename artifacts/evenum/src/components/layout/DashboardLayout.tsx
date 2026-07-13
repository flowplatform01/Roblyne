import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from './Layout';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export function DashboardLayout({ children, orgId }: { children: React.ReactNode, orgId?: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <Layout>
      <SidebarProvider>
        <div className="flex flex-1 w-full min-h-[calc(100vh-4rem)]">
          <AppSidebar orgId={orgId} />
          <SidebarInset className="flex-1 bg-muted/20">
            <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </Layout>
  );
}
