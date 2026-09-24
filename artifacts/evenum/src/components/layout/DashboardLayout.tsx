import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from './Layout';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

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
            <div className="sticky top-16 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
              <SidebarTrigger
                className="h-10 w-10 shrink-0"
                aria-label="Open workspace navigation"
                title="Open workspace navigation"
              />
              <span className="text-sm font-medium text-muted-foreground">
                {orgId ? "Organization workspace" : "Workspace"}
              </span>
            </div>
            <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </Layout>
  );
}
