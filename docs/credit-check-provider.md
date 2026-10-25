# External tenant credit checks

MyRental SA links landlords to MRI TPN. There is no live bureau API connection or applicant questionnaire in MyRental SA.

- Registration / provider application: https://app.tpn.co.za/
- Existing account sign-in: https://sso.tpn.co.za/
- Official source for these links: https://mrisoftware.tpn.co.za/contact-us/

No applicant information is placed in URLs or sent automatically. The landlord uses their own provider account and obtains the applicant's written consent. Commercial/API onboarding is deferred.

The unused owner-only screening table was created during preparation and remains protected; it is not exposed by an app screen. Its migration is retained as a record of the deployed schema.

## Property advertising

The Rent journey and property Contacts tab open Property24’s official private rental listing page at https://www.property24.com/private-listing/rent-my-property. Existing users can open https://manage.property24.com/ to sign in. No property or applicant data is placed in either URL; publishing and payment happen on Property24.
