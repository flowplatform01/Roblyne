# Evenum Stack

This document describes the current Evenum application stack and how its main
pieces fit together.

## Product architecture

Evenum is a web platform for organizations, elections, events, campaigns,
discovery, and organization finance. It is implemented as a pnpm TypeScript
workspace with separate frontend and API artifacts plus shared libraries.

```text
Browser
  │
  ├─ Evenum React SPA
  │    ├─ Vite build and development server
  │    ├─ Wouter client-side routing
  │    ├─ TanStack Query server-state management
  │    └─ generated API client
  │
  └─ /api
       └─ Express API server
            ├─ session authentication
            ├─ route validation
            ├─ business logic
            └─ Drizzle ORM
                 └─ PostgreSQL
```

## Frontend

- **Language:** TypeScript
- **Framework:** React 19
- **Build tool:** Vite
- **Routing:** Wouter
- **Server state and API caching:** TanStack React Query
- **Forms:** React Hook Form
- **Validation:** Zod through generated API schemas and form resolvers
- **Styling:** Tailwind CSS v4 through the Vite plugin, with CSS variables
  defined in `artifacts/evenum/src/index.css`
- **Component primitives:** Radix UI
- **Icons:** Lucide React and React Icons
- **Charts:** Recharts
- **Animation:** Framer Motion
- **Internationalization:** i18next with `react-i18next`
- **Notifications:** Sonner and the local toast components
- **QR functionality:** `qrcode.react` and `html5-qrcode`
- **PWA support:** `vite-plugin-pwa`

The frontend is a client-rendered single-page application. Routes are
lazy-loaded into Vite chunks, and the production artifact is served as static
files with an SPA fallback to `index.html`.

The main frontend artifact is:

```text
artifacts/evenum
```

## Backend API

- **Runtime:** Node.js
- **Language:** TypeScript
- **HTTP framework:** Express 5
- **API base path:** `/api`
- **Request validation:** Zod schemas generated from the OpenAPI contract
- **Database access:** Drizzle ORM with the Node PostgreSQL driver
- **Authentication:** Email/password authentication using bcryptjs
- **Sessions:** `express-session` stored in PostgreSQL with
  `connect-pg-simple`
- **Security middleware:** Helmet, CORS, request-size limits, and
  express-rate-limit
- **Logging:** Pino, `pino-http`, and pretty development output
- **Build:** esbuild

The API server is a separate artifact:

```text
artifacts/api-server
```

Its major route areas are:

- Health and client diagnostics
- Registration, login, logout, profile, and password changes
- Organizations and memberships
- Elections, candidates, positions, ballots, and results
- Events, ticket types, registrations, and ticketing
- Campaigns and participation
- Public discovery and search
- Organization finance
- Platform administration
- Payments and FlowPay webhook processing

## Data layer

The database layer is the shared workspace package:

```text
lib/db
```

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Driver:** `pg`
- **Schema management:** Drizzle Kit
- **Schema domains:** users, organizations, elections, events, campaigns,
  financial records, and payments
- **Connection configuration:** `DATABASE_URL`

The API imports the shared database instance and schema from
`@workspace/db`. The pool is intentionally kept small for the Replit-managed
PostgreSQL environment.

## API contract and generated libraries

Evenum uses an OpenAPI-first contract:

```text
lib/api-spec/openapi.yaml
```

The contract is used with Orval to generate two shared libraries:

- `@workspace/api-client-react`
  - React Query hooks and typed request/response models
  - custom fetch implementation
  - base URL and optional bearer-token support
- `@workspace/api-zod`
  - server-side Zod schemas for request validation

This keeps the frontend hooks, server validation, and API documentation tied
to the same contract. The generated packages are located at:

```text
lib/api-client-react
lib/api-zod
```

## Authentication and security model

Evenum currently uses browser session cookies rather than a third-party
identity provider:

1. A user registers or logs in with an email address and password.
2. Passwords are hashed with bcryptjs.
3. The API regenerates the Express session and stores the user ID in it.
4. Session records are persisted in PostgreSQL.
5. The browser sends the session cookie with API requests.

Important runtime configuration:

- `DATABASE_URL` is required by the database package and session store.
- `SESSION_SECRET` is required for a secure production session configuration.
- `PORT` is required by both application servers.
- `BASE_PATH` is required by the Vite frontend.

The API also applies proxy-aware settings for Replit, HTTP security headers,
request IDs, JSON/body limits, rate limits, and a final JSON error handler.

## Payments

Payment status and webhook handling are implemented in the API. FlowPay
webhooks are verified with an HMAC signature over the exact raw request body,
using event IDs and event types for processing and duplicate protection.

Payment-specific implementation lives under the API server's payment
libraries and routes. Payment credentials and signing secrets belong in
workspace secrets and are not documented here.

## Replit artifacts and workflows

Evenum is organized as Replit artifacts:

| Artifact | Purpose | Development command |
| --- | --- | --- |
| `artifacts/evenum` | React/Vite web application | `pnpm --filter @workspace/evenum run dev` |
| `artifacts/api-server` | Express API | `pnpm --filter @workspace/api-server run dev` |
| `artifacts/mockup-sandbox` | Isolated component preview server | `pnpm --filter @workspace/mockup-sandbox run dev` |

The web artifact serves the browser application and the API artifact serves
the `/api` paths. The artifact manifests under each
`.replit-artifact/artifact.toml` define preview paths, ports, builds, and
production behavior.

## Workspace and tooling

- **Package manager:** pnpm
- **Workspace layout:** `artifacts/*`, `lib/*`, `lib/integrations/*`, and
  `scripts`
- **TypeScript:** project references with shared compiler settings
- **Formatting:** Prettier
- **Static checks:** workspace TypeScript typechecks
- **Development environment:** Replit workflows and proxied previews

Common commands from the repository root:

```bash
# Install dependencies
pnpm install

# Typecheck shared libraries and artifacts
pnpm run typecheck

# Build the complete workspace
pnpm run build

# Generate API client and Zod code from OpenAPI
pnpm --filter @workspace/api-spec run codegen
```

## Source-of-truth locations

| Concern | Location |
| --- | --- |
| Frontend entry point | `artifacts/evenum/src/main.tsx` |
| Frontend routing/providers | `artifacts/evenum/src/App.tsx` |
| Frontend theme and design tokens | `artifacts/evenum/src/index.css` |
| API middleware and server setup | `artifacts/api-server/src/app.ts` |
| API route registration | `artifacts/api-server/src/routes/index.ts` |
| Database connection | `lib/db/src/index.ts` |
| Database schema | `lib/db/src/schema/` |
| OpenAPI contract | `lib/api-spec/openapi.yaml` |
| Generated React API client | `lib/api-client-react/src/generated/` |
| Generated server Zod schemas | `lib/api-zod/src/generated/` |
| Demo and migration scripts | `scripts/` |

This document should be updated when a major runtime, persistence, API
contract, authentication, or deployment decision changes.