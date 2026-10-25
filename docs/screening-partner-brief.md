# MyRental SA: screening partner brief

Prepared 25 October 2026. Status: proposal prepared; no partnership or live bureau integration is active. No applicant data or partnership request has been sent.

## Proposed route

MRI TPN is the first provider to approach because its published offering covers South African rental screening and it has a documented MRI partner programme. Commercial and API eligibility for MyRental SA must be confirmed with the provider.

Official sources:
- Credit bureau services: https://mrisoftware.tpn.co.za/solutions/credit-bureau/
- Provider enquiries: https://mrisoftware.tpn.co.za/contact-us/
- MRI partner programme: https://www.mrisoftware.com/za/partners/

## Reviewable enquiry draft

We operate MyRental SA, a self-service rental-management app for South African private landlords. We would like to explore an authorised screening integration so landlords can record written applicant consent, request the appropriate screening product, and securely receive the resulting report within their own account. Please confirm partner eligibility, onboarding requirements, pricing and minimum commitments, approved products, consent requirements, integration documentation, sandbox access, API authentication, report-delivery options, retention requirements and support arrangements. Landlords would retain responsibility for reviewing reports and making lawful tenancy decisions.

## What is implemented now

- Owner-only applicant cases, written-consent evidence references and review checklists.
- External provider handoff with no applicant information in links or query strings.
- Private report upload and download, with provider report reference and progress tracking.
- No automated applicant score, approval or decline.

## Required before live credit checks

1. The account owner approves commercial terms and completes any provider verification.
2. The provider confirms authorised products and supplies integration/sandbox documentation.
3. Credentials are configured server-side through a protected secret mechanism; they must never be put into browser code, chat, source control or public environment variables.
4. Implement verified consent enforcement, minimal request payloads, per-owner authorisation, auditable requests, idempotent billing and authenticated report delivery using the provider's actual specification.
5. Test with provider-issued sandbox identities, then verify a consented end-to-end request before launch.

The tenant portal remains out of scope at the owner's request.
