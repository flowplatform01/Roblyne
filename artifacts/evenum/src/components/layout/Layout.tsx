import React from 'react';
import { Navbar } from './Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { SupportFooter } from './SupportFooter';
import { AuthLoadingShell } from '@/components/loading/LoadingStates';

export function Layout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingShell />;
  }

  return (
      <div className="min-h-[100dvh] flex flex-col bg-background overflow-x-clip w-full">
      <Navbar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
        <SupportFooter />
    </div>
  );
}
