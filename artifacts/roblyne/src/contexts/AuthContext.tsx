import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useGetMe, getGetMeQueryKey, AuthUser } from '@workspace/api-client-react';

const AUTH_SNAPSHOT_KEY = 'roblyne:auth-snapshot';

function readAuthSnapshot(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthUser>;
    return typeof value.id === 'number' && typeof value.name === 'string' && typeof value.email === 'string'
      ? value as AuthUser
      : null;
  } catch {
    return null;
  }
}

function writeAuthSnapshot(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_SNAPSHOT_KEY);
  } catch {}
}

export function clearAuthSnapshot(): void {
  writeAuthSnapshot(null);
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSessionUnavailable: boolean;
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isSessionUnavailable: false,
  retrySession: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshotUser, setSnapshotUser] = useState<AuthUser | null>(() => readAuthSnapshot());
  const { data: fetchedUser, isLoading, isError, error, refetch } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      queryKey: getGetMeQueryKey(),
    },
    request: {
      timeoutMs: 15_000,
    },
  });

  useEffect(() => {
    if (!fetchedUser) return;
    setSnapshotUser(fetchedUser);
    writeAuthSnapshot(fetchedUser);
  }, [fetchedUser]);

  useEffect(() => {
    if ((error as { status?: number } | null)?.status !== 401) return;
    setSnapshotUser(null);
    clearAuthSnapshot();
  }, [error]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    window.addEventListener('focus', revalidate);
    window.addEventListener('online', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('online', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [refetch]);

  const user = fetchedUser ?? snapshotUser;

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading: isLoading && !snapshotUser,
        isAuthenticated: !!user,
        isSessionUnavailable: isError,
        retrySession: () => { void refetch(); },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
