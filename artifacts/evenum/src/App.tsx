import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';

// Pages
import NotFound from '@/pages/not-found';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import CreateOrganization from '@/pages/CreateOrganization';
import OrganizationWorkspace from '@/pages/OrganizationWorkspace';

// Engines
import CreateElection from '@/pages/CreateElection';
import ElectionDetail from '@/pages/ElectionDetail';
import ElectionVote from '@/pages/ElectionVote';
import ElectionResults from '@/pages/ElectionResults';

import CreateEvent from '@/pages/CreateEvent';
import EventDetail from '@/pages/EventDetail';
import EventRegister from '@/pages/EventRegister';

import CreateCampaign from '@/pages/CreateCampaign';
import CampaignDetail from '@/pages/CampaignDetail';
import CampaignParticipate from '@/pages/CampaignParticipate';

import Settings from '@/pages/Settings';
import AdminDashboard from '@/pages/AdminDashboard';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public Pages */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Authed Workspace Pages */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/organizations/new" component={CreateOrganization} />
      <Route path="/organizations/:id" component={OrganizationWorkspace} />
      
      {/* Election Routes */}
      <Route path="/elections/new" component={CreateElection} />
      <Route path="/elections/:id" component={ElectionDetail} />
      <Route path="/elections/:id/vote" component={ElectionVote} />
      <Route path="/elections/:id/results" component={ElectionResults} />

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
