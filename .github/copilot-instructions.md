# Copilot instructions for CRMPro

## Big picture architecture
- Frontend is Vite + React + TypeScript with Tailwind styles. Entry point loads dynamic env config before rendering the app: Root waits on `waitForConfig()` in [src/main.tsx](src/main.tsx).
- Auth is handled by an external OAuth-like system. `externalAuth` stores tokens in localStorage and provides refresh/logout flows; `AuthProvider` consumes it in [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) and redirects to /login when unauthenticated in [src/App.tsx](src/App.tsx).
- Navigation is module-based (not route-based) once logged in. The Sidebar switches `activeModule` from `NavigationContext`, and `MainApp` renders modules via a switch in [src/App.tsx](src/App.tsx) and [src/contexts/NavigationContext.tsx](src/contexts/NavigationContext.tsx).
- Data layer uses Supabase with a dual-client proxy: `supabase.from()`/`supabase.rpc()` use an authenticated client only when an external token is present, otherwise the base client. See [src/lib/supabase.ts](src/lib/supabase.ts).
- Background workflows are implemented as React hooks + Supabase realtime + Edge Functions:
  - Invoice validation uses `process-pending-invoices` via HTTP in [src/hooks/useInvoiceAutoValidation.ts](src/hooks/useInvoiceAutoValidation.ts).
  - Invoice PDF sending uses `supabase.functions.invoke('send-invoice-pdf')` in [src/hooks/useInvoicePdfQueue.ts](src/hooks/useInvoicePdfQueue.ts).
  - Email queue hook exists but is disabled in [src/App.tsx](src/App.tsx).
- Twilio integration spans UI + Supabase edge functions. `useTwilioDevice` gets tokens from `twilio-access-token` and handles incoming/outgoing calls; `TwilioService` writes logs to Supabase tables and calls Twilio REST APIs. See [src/hooks/useTwilioDevice.ts](src/hooks/useTwilioDevice.ts) and [src/lib/twilioService.ts](src/lib/twilioService.ts).
- Supabase Edge Functions live under [supabase/functions](supabase/functions); frontend calls them via `supabase.functions.invoke` or fetch to `${VITE_SUPABASE_URL}/functions/v1/...`.

## Developer workflows
- Dev server: `npm run dev` (Vite).
- Build: `npm run build`.
- Typecheck: `npm run typecheck`.
- Lint: `npm run lint`.

## Project-specific conventions
- Dynamic env config is fetched from a Supabase function and injected into `import.meta.env`; rely on `waitForConfig()` before using env vars. See [src/lib/envLoader.ts](src/lib/envLoader.ts).
- Permissions are module-scoped and keyed in Spanish (e.g., `clientes`, `campanas`, `ordenes`). Use `usePermissions()` helpers to gate UI/features. See [src/hooks/usePermissions.ts](src/hooks/usePermissions.ts).
- Auth tokens are stored in localStorage keys (`auth_token`, `refresh_token`, `auth_user`) and Supabase storage keys prefixed `sb-` are cleared on sign-in/out. See `externalAuth` in [src/lib/externalAuth.ts](src/lib/externalAuth.ts).

## Integration points
- External auth endpoints use `VITE_AUTH_*` and `VITE_AUTH_CODE_EXCHANGE_URL` injected by the env loader. See [src/lib/externalAuth.ts](src/lib/externalAuth.ts).
- Twilio requires `twilio_config` in Supabase plus edge functions `twilio-access-token` and `twilio-connect-call`. See [src/lib/twilioService.ts](src/lib/twilioService.ts).
- Invoice queues depend on Supabase tables (`invoice_pdf_queue`, `invoice_email_queue`, `invoices`) and functions (`process-pending-invoices`, `send-invoice-pdf`, `process-invoice-email-queue`). See hooks in [src/hooks](src/hooks).
