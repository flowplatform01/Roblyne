import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';

// Lazy-load every route so Vite splits them into separate chunks.
// Auth and public pages load eagerly since they are near the critical path.
const Home = lazy(() => import('@/pages/Home'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const CreateOrganization = lazy(() => import('@/pages/CreateOrganization'));
const OrganizationWorkspace = lazy(() => import('@/pages/OrganizationWorkspace'));
const OrganizationPublic = lazy(() => import('@/pages/OrganizationPublic'));

const CreateElection = lazy(() => import('@/pages/CreateElection'));
const ElectionDetail = lazy(() => import('@/pages/ElectionDetail'));
const ElectionVote = lazy(() => import('@/pages/ElectionVote'));
const ElectionResults = lazy(() => import('@/pages/ElectionResults'));

const CreateEvent = lazy(() => import('@/pages/CreateEvent'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));
const EventRegister = lazy(() => import('@/pages/EventRegister'));

const CreateCampaign = lazy(() => import('@/pages/CreateCampaign'));
const CampaignDetail = lazy(() => import('@/pages/CampaignDetail'));
const CampaignParticipate = lazy(() => import('@/pages/CampaignParticipate'));

const CandidateProfile = lazy(() => import('@/pages/CandidateProfile'));
const Settings = lazy(() => import('@/pages/Settings'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const NotFound = lazy(() => import('@/pages/not-found'));

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
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
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

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
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
  );
}

export default App;
