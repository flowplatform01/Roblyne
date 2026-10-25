import { lazy, Suspense, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteLoadingShell } from '@/components/loading/LoadingStates';
import { ThemeProvider } from 'next-themes';

/**
 * Vite's split chunks are content-hashed. After a deployment, an already-open
 * tab can request a chunk from the previous build and receive a module-load
 * error. Retry once, then reload once so the browser gets the new index/chunk
 * map. The session flag prevents a persistent server failure from causing a
 * reload loop.
 */
function lazyWithChunkRecovery<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await loader();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('evenum:chunk-recovery');
      }
      return module;
    } catch (error) {
      if (typeof window === 'undefined') throw error;

      const hasRetried = sessionStorage.getItem('evenum:chunk-recovery') === '1';
      if (hasRetried) {
        sessionStorage.removeItem('evenum:chunk-recovery');
        throw error;
      }

      sessionStorage.setItem('evenum:chunk-recovery', '1');
      window.location.reload();
      return new Promise<never>(() => {});
    }
  });
}

// Lazy-load every route so Vite splits them into separate chunks.
const Home = lazyWithChunkRecovery(() => import('@/pages/Home'));
const Login = lazyWithChunkRecovery(() => import('@/pages/Login'));
const Register = lazyWithChunkRecovery(() => import('@/pages/Register'));
const Dashboard = lazyWithChunkRecovery(() => import('@/pages/Dashboard'));
const CreateOrganization = lazyWithChunkRecovery(() => import('@/pages/CreateOrganization'));
const OrganizationWorkspace = lazyWithChunkRecovery(() => import('@/pages/OrganizationWorkspace'));
const OrganizationPublic = lazyWithChunkRecovery(() => import('@/pages/OrganizationPublic'));

const CreateElection = lazyWithChunkRecovery(() => import('@/pages/CreateElection'));
const ElectionDetail = lazyWithChunkRecovery(() => import('@/pages/ElectionDetail'));
const ElectionVote = lazyWithChunkRecovery(() => import('@/pages/ElectionVote'));
const ElectionResults = lazyWithChunkRecovery(() => import('@/pages/ElectionResults'));

const CreateEvent = lazyWithChunkRecovery(() => import('@/pages/CreateEvent'));
const EventDetail = lazyWithChunkRecovery(() => import('@/pages/EventDetail'));
const EventRegister = lazyWithChunkRecovery(() => import('@/pages/EventRegister'));

const CreateCampaign = lazyWithChunkRecovery(() => import('@/pages/CreateCampaign'));
const CampaignDetail = lazyWithChunkRecovery(() => import('@/pages/CampaignDetail'));
const CampaignParticipate = lazyWithChunkRecovery(() => import('@/pages/CampaignParticipate'));

const CandidateProfile = lazyWithChunkRecovery(() => import('@/pages/CandidateProfile'));
const Settings = lazyWithChunkRecovery(() => import('@/pages/Settings'));
const AdminDashboard = lazyWithChunkRecovery(() => import('@/pages/AdminDashboard'));
const NotFound = lazyWithChunkRecovery(() => import('@/pages/not-found'));
const DevPaymentSimulator = import.meta.env.DEV
  ? lazyWithChunkRecovery(() => import('@/pages/DevPaymentSimulator'))
  : null;

// Production-tuned query client:
// - staleTime: 30s for read-heavy data (discover, lists)
// - gcTime: 5min so navigating back feels instant
// - retry: only on network errors, not on 4xx (user/auth errors)
// - refetchOnWindowFocus: false prevents redundant fetches on tab switch
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on client errors (auth, not found, validation)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

function PageFallback() {
  return <RouteLoadingShell />;
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        {/* Public Pages */}
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        {/* Authed Workspace Pages */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/organizations/new" component={CreateOrganization} />
        <Route path="/organizations/:id" component={OrganizationWorkspace} />
        <Route path="/organizations/:id/public" component={OrganizationPublic} />

        {/* Election Routes */}
        <Route path="/elections/new" component={CreateElection} />
        <Route path="/elections/:id" component={ElectionDetail} />
        <Route path="/elections/:id/vote" component={ElectionVote} />
        <Route path="/elections/:id/results" component={ElectionResults} />
        <Route path="/candidates/:electionId/:candidateId" component={CandidateProfile} />

        {/* Event Routes */}
        <Route path="/events/new" component={CreateEvent} />
        <Route path="/events/:id" component={EventDetail} />
        <Route path="/events/:id/register" component={EventRegister} />

        {/* Campaign Routes */}
        <Route path="/campaigns/new" component={CreateCampaign} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/campaigns/:id/participate" component={CampaignParticipate} />

        {/* Settings */}
        <Route path="/settings" component={Settings} />

        {/* Platform Admin */}
        <Route path="/admin" component={AdminDashboard} />

        {DevPaymentSimulator && <Route path="/dev-payment/:id" component={DevPaymentSimulator} />}

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="evenum-theme"
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
