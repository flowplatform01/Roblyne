---
name: Evenum api-server build constraints
description: Known gotchas when adding code to the api-server or api-client-react packages
---

## Rule 1: `zod` is not a direct dependency of `api-server`

The api-server (`artifacts/api-server`) does NOT have `zod` in its `package.json`. esbuild bundles everything and will fail with "Could not resolve zod" if you import it directly.

**Why:** The server uses `@workspace/api-zod` for pre-built Zod schemas. Direct route validation should either use manual inline checks or add zod explicitly to the api-server `package.json` dependencies.

**How to apply:** For simple endpoint validation (type + length checks), use manual checks. If the endpoint is complex, add `zod` to the api-server `package.json` before importing it.

## Rule 2: `customFetch` must be explicitly exported from api-client-react

`lib/api-client-react/src/index.ts` only re-exports selected items from `custom-fetch.ts`. `customFetch` itself was not exported by default. Any page importing `customFetch` from `@workspace/api-client-react` will get a runtime "does not provide an export" error unless it's listed in the index exports.

**Fix applied:** Added `customFetch` to the exports in `lib/api-client-react/src/index.ts`.

**How to apply:** If adding new utility functions to `custom-fetch.ts`, also update `index.ts` exports.

## Rule 3: ImageUpload produces base64 data URLs, not HTTP URLs

The `ImageUpload` component converts files to base64 data URLs. Zod schema fields that use `.url()` validation will reject these. Always use `z.string().optional()` (no `.url()`) for fields that accept ImageUpload output.

**Fields fixed:** `logoUrl` in CreateOrganization, `photoUrl` in ElectionDetail candidate form, `coverImageUrl` in CreateEvent and CreateCampaign.

## Rule 4: AuthContext does not expose setUser

`AuthContext` is backed by React Query (`useGetMe`). To refresh user data after a profile update, call `queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() })` — do not try to call `setUser` directly.
