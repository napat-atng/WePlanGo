# WePlanGo

WePlanGo is a mobile-first trip planner for friends. The real room-based workspace, data model, configuration and rollout checks are documented in [docs/WORKSPACE.md](docs/WORKSPACE.md). Earlier group-based MVP specifications remain as historical context.

Production: [weplango-napat6.vercel.app](https://weplango-napat6.vercel.app). See [acceptance evidence](docs/production/ACCEPTANCE.md) for the verified flows and test scope.

## Local development

Open `/trips` for the Supabase-backed workspace and `/profile` for availability and Calendar. The editable sample prototype remains at `/mockup`; it uses browser-only sample data. See [prototype specification](docs/MOCKUP.md).

1. Install Node.js 22 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key. Never commit `.env.local`.
3. Run `npm run dev` and open `http://localhost:3000`.

Run `npm run build`, `npm run lint`, and `npm test` before submitting code. On PowerShell, use `npm.cmd` if `npm.ps1` is blocked.

## Auth and database setup

Enable Google in Supabase Auth. Set the Google OAuth redirect URI to `https://deondfdbovycllaxfuag.supabase.co/auth/v1/callback`. Add `http://localhost:3000/**` to Supabase Authentication → URL Configuration → Redirect URLs for development, and the exact production `/auth/callback` URL for production. The local wildcard includes the `next` query used to return to a profile or invitation. Keep Site URL set to the deployed site.

Database changes live in `supabase/migrations/`; policy tests live in `supabase/tests/`. Workspace migrations copy legacy trips into room tables while preserving the source tables. Tests run with `supabase test db` when a local Supabase stack and Docker are available.

Calendar OAuth uses a separate consent flow. See [Google Calendar setup and worker deployment](docs/WORKSPACE.md#google-calendar). Never expose the encryption key, OAuth secret, service-role key or cron secret through `NEXT_PUBLIC_` variables.
