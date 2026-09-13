# MyRental SA

A guided rental-management app for South African private landlords.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The app includes Supabase landlord authentication, persistent sessions, secure first-property onboarding and a demo fallback when environment variables have not yet been configured.

## Connect Supabase

1. Create a new Supabase project.
2. Open the SQL Editor and run `supabase/schema.sql` once.
3. Copy `.env.example` to `.env.local` for local development.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel Environment Variables.
5. Redeploy the latest Vercel deployment.

Never add the Supabase service-role key to this front-end project.

## Deploy to Vercel

Import the GitHub repository into Vercel. Select Vite, use `npm run build`, and set the output directory to `dist`.
