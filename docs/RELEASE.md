# MyRental SA backend and Android release

## Prepared scope

- Isolated MyRental SA Supabase backend, owner admin dashboard and membership controls.
- PayFast R89 immediate monthly subscription, server-validated notifications, idempotent ledger, paid-through access, in-app cancellation/reason, first-payment 48-hour refund-review queue. Recording a refund does not transfer money.
- Personalised transactional payment reminders after 10 minutes, 24 hours and monthly while outstanding; confirmed payments, free staff access, cancellation and suspension stop reminders.
- Private municipal/repair/expense evidence, March–February cash-flow report and CSV/print/PDF output. Invoice receipts post rent and service recovery separately, once.
- Monthly and supplementary-service branded invoice PDFs, municipal tenant-share import, landlord bank/contact snapshots, configurable send/due/overdue-alert days, optional scheduled email, manual WhatsApp/PDF sharing, partial/full receipt tracking, friendly reminders and reviewed CPA breach drafts.
- Capacitor Android shell, API 36, native PDF printing and CSV/PDF sharing, account deletion request entry points, public privacy/deletion pages and a manual build workflow.

## Production deployment status — 24 October 2026

The user approved deployment. All three migrations below were applied to MyRental SA project `hneloyinjdhgocezglxl`, the verified owner was assigned administration access, and the `membership` Edge Function is active:

1. `supabase/membership.sql`
2. `supabase/property-finances.sql`
3. `supabase/rental-invoices.sql`

The frontend was deployed from merged PR #2 (`fb3b332a2ff91443f16285b8d8903c71d84dc374`). The live app and privacy page returned HTTP 200; the unauthenticated membership endpoint correctly returned HTTP 401. Private financial-document storage was verified. Billing remains disabled in sandbox mode, and payment/email credentials still need configuration. Authenticated production flows and provider sandbox flows are not yet verified.

They preserve existing rental records. Billing defaults to disabled and sandbox enabled. The restrictive access policy passes existing authenticated owners while billing is disabled; owner isolation remains in force. The verified account owner must be inserted into `billing_admins` by server-side administration after approval; no client can self-promote.

The migration also removes direct API execution rights from the existing signup trigger function, creates missing `rental_records`/`maintenance_items`, and adds a cron job. The job only invokes email work when subscriptions are enabled and an email credential exists. Owner suspension always blocks property access, including free accounts.

## Backend deployment order

1. Apply approved SQL files in order to project `hneloyinjdhgocezglxl` only.
2. Assign the verified owner in `billing_admins` using the authenticated user's confirmed identity. Do not copy RISE users, tokens or database keys.
3. Deploy Edge Function `membership` from `supabase/functions/membership/index.ts`, including `rentals.ts`, `rules.js`, `payfast.js`, `deno.json` and `shared/rental-documents.js`. Platform JWT enforcement must be off because PayFast ITN and the protected cron job do not have user JWTs; all ordinary actions validate JWTs with `auth.getUser`, while ITN uses signature + merchant + amount + PayFast validation and cron uses a random server-only job secret.
4. Deploy this exact frontend commit. Keep subscriptions disabled until configuration and testing are complete.
5. In owner Admin → Billing setup, enter MyRental SA's PayFast merchant ID/key/passphrase and a verified Resend sender/API key. Values are encrypted at rest with AES-GCM using a key derived from the Edge service-role environment; values are never returned to the client. Re-enter saved configuration after rotating the service-role key. No secret belongs in `VITE_*`, Git or logs.
6. Test sandbox checkout, successful/failed/delayed/duplicate ITNs, renewal, expiry, cancellation, refund review and cross-account access. Check provider recurring billing is enabled. Do not make a real charge as a verification step without the payer's consent.
7. Verify private evidence upload/open, receipt-to-ledger posting and scheduled email against controlled test addresses. No tenant emails have been sent during development.
8. Review legal/privacy language, confirm support contact details and notice service/deadline rules before public launch. The CPA draft is not a universal cancellation or eviction notice. Notice periods are not auto-calculated; the composer requires a verified deadline and blocks periods shorter than 20 weekdays, but holidays/service still need confirmation.

## Android release model

The first Android release is **consumption only**: existing members sign in, use their entitlement, manage cancellation, and request deletion. PayFast checkout and promotional purchase/signup flows are not shown in the native app. The website retains PayFast. Adding purchases inside the Play-distributed app requires Google Play Billing or confirmed eligibility/enrolment in an applicable alternative-billing programme; this branch does not claim Play Billing support.

Package ID: `za.co.myrentalsa.app` (proposed; confirm availability in Play Console before the first upload). Minimum API 24; target/compile API 36. App title: MyRental SA.

Local commands with Node 22+, JDK 21 and Android SDK 36:

```sh
npm ci
npm test
npm run android:debug
```

For signed release builds, configure `MYRENTAL_UPLOAD_STORE_FILE`, `MYRENTAL_UPLOAD_STORE_PASSWORD`, `MYRENTAL_UPLOAD_KEY_ALIAS`, `MYRENTAL_UPLOAD_KEY_PASSWORD` and an increasing `MYRENTAL_VERSION_CODE`, then run `npm run android:bundle`. Never commit the upload key.

GitHub Actions automatically builds debug APKs on relevant main-branch changes and supports manual signed release AABs. Configure a `play-release` environment with required review and a `main` branch restriction, and add its four signing secrets (keystore in `MYRENTAL_KEYSTORE_BASE64`; the three password/alias secrets above). Release builds reject branches other than `main`. No workflow publishes to Google Play automatically.

## Play Console handoff

- Verified developer account and app record; account terms and any registration payment are owner actions.
- Enrol in Play App Signing and securely retain the upload key.
- Upload the signed AAB to internal testing; test real devices (sign-in/session recovery, document picker, PDF sharing/printing, Android back navigation, offline/error states).
- Complete app access with a dedicated reviewer account containing synthetic rental data and free test access, never the owner's login or real tenant files.
- Store text, screenshots from the actual app, a 512px icon, a 1024×500 feature graphic, developer/support contact details, content rating, target audience, privacy policy URL and Data safety disclosures. Store icon source is under `branding/`; feature graphic is included; actual-device screenshots are still required.
- Public privacy URL after deployment: `/privacy.html`; account deletion URL: `/delete-account.html`. Deletion requests must be operationally reviewed and completed, with billing stopped and lawful retention explained. The current feature records requests; it does not automatically purge accounts or claim completed deletion.
- Disclose account/contact data, property/tenant information, user-selected photos/documents, financial/payment references and activity diagnostics according to actual collection and service-provider use. Do not mark the app as collecting no personal data.
- New personal developer accounts may require 12 continuously opted-in testers for 14 days and a production-access application.

The Android debug APK compiled successfully in GitHub Actions run `40096935404` from main commit `b8b4735cb660732d820a5ab48bdfe784e87220d0`. The `MyRental-SA-debug` artifact is available on that run. Signed release AAB generation, real-device testing and Google review remain outstanding. Play Console sign-in returned a Google “Something went wrong” error in the cloud browser; no app was submitted.

## Validation

`npm test` covers database/RLS isolation, duplicate notification/payment handling, cancellation replay, refund-request idempotency, receipt posting and allocation, March–February/leap years, tenant-recovery double counting, CSV safety, notice drafts and actual PDF generation. PDF output was rendered for visual review with synthetic data. Browser checks use an isolated local fixture app; they do not prove live database or provider configuration.
