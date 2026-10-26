# Landlord document shop

Public catalogue: `/landlord-documents/`. Generated static HTML contains all copy without requiring authentication or JavaScript. The existing root and landlord app remain intact. Edit the catalogue and product content in `scripts/build-document-shop.mjs`; `npm run build` regenerates the pages and sitemap. Styling is in `public/landlord-documents/shop.css`.

## Current release

A prelaunch catalogue, not a working ecommerce checkout. Prices are planned launch prices. No products are claimed to be attorney-reviewed, no sample downloads are advertised, and no payments or personal data are collected. No purchase conversion is emitted without an actual verified sale. CPA and non-CPA leases are R500 per version; the inspection pair is R349; breach and cancellation letters are R390 each; renewal addendum is R299; individual and juristic application forms are R199 per version. The earlier starter pack is withdrawn.

## Sales launch dependencies

- Prepare the actual Word/PDF files, samples and clear reuse licence.
- Arrange qualified South African property attorney review for legal documents and version-selection instructions. Record reviewer, scope and review date before making review claims.
- Configure a separate one-off checkout. Do not reuse subscription webhooks without a distinct product/order model.
- Validate payment server-side and deliver private files using signed, expiring access after verified payment. Browser return URLs must never grant download access by themselves.
- Test successful payment, failed payment, duplicate webhook, refund handling and expired download links.
- Publish seller/contact details, delivery terms, refund policy and applicable consumer disclosures.
- Replace prelaunch text and add accurate product offer structured data only when products are actually available.

## Search and measurement

- The canonical origin is currently https://myrental-sa.vercel.app. If a custom domain is selected, update the generator origin, canonical URLs and sitemap together and redirect the old origin consistently.
- Verify ownership of the public origin in Google Search Console, submit `/sitemap.xml` and inspect the catalogue and one product URL. Account verification has not been performed in this release.
- Configure a real analytics property and consent/privacy handling before adding its identifier. Record product views and checkout starts separately from verified purchases; no analytics property or ad account is configured here.
- Set up a Google Search campaign only after checkout and purchase measurement pass testing. No campaign or ad spend has been started.
- Compare actual purchase conversion value with acquisition cost before increasing spend. No ranking or traffic-volume claim is made.


## Payment integration 26 October 2026

A separate document-shop Edge Function is deployed. Merchant details are held in encrypted Vault secrets, read through a service-role-only RPC. Passphrase is never returned to browsers. Public checkout uses server-authoritative product prices, one-off payment fields and a random access token whose hash is stored with the order. Webhook verification checks the signature, merchant, order, exact gross amount, COMPLETE state and PayFast server validation. Download access requires a paid order, matching unexpired token and the purchased file checksum. No return URL marks an order paid. Download access lasts 30 days, and email delivery is not included.

Activation was declined by the approval system with no stated reason. All eight packages remain sale_enabled=false; the checkout page has a disabled payment button and states that activation is pending. No production payment was submitted. Live endpoint confirmed that purchases remain blocked. All 62 automated tests passed. A real payment and complete provider callback/download test remain unverified.


## Activation approved

The user explicitly approved activation after the earlier declined attempt. All eight packages are enabled and payment buttons are active. Live integration checks validate one-off checkout preparation and reject unpaid or invalid-token downloads. No real charge was made by the agent; full provider payment/callback/download still requires the first completed transaction.
