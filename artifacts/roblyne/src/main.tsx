import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import '@/i18n';
import App from './App';
import { describeUnknownError, reportClientDiagnostic } from '@/lib/diagnostics';
import { setBaseUrl } from '@workspace/api-client-react';
import { getApiUrl } from '@/lib/api-url';

import './index.css';

setBaseUrl(getApiUrl());

window.addEventListener('error', (event) => {
  reportClientDiagnostic({
    event: 'error',
    message: event.message || 'Unhandled browser error',
    stack: event.error instanceof Error ? event.error.stack : undefined,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportClientDiagnostic({
    event: 'unhandledrejection',
    message: describeUnknownError(event.reason),
    stack: event.reason instanceof Error ? event.reason.stack : undefined,
  });
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
