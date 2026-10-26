import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
export const origin='https://myrental-sa.vercel.app'
export const products=[
 {
  "slug": "residential-lease-agreement-south-africa",
  "name": "Residential lease agreement — CPA",
  "price": 500,
  "tag": "CPA version",
  "description": "CPA residential lease agreement template for South African landlords. Price R500.",
  "intro": "A separate residential lease version intended for tenancies where the Consumer Protection Act applies.",
  "includes": [
   "Landlord, tenant and property schedules",
   "Rental, deposit and payment arrangements",
   "Term, occupation and responsibility fields",
   "Inspection references and special-conditions schedule",
   "CPA-specific provisions and version-selection instructions"
  ],
  "when": "A lease needs to suit the parties, property and transaction. Choose the version that fits the transaction; the label does not determine which legislation applies.",
  "faq": "Will one lease suit every landlord?",
  "answer": "No. The appropriate agreement depends on the circumstances, including whether the Consumer Protection Act applies. The download includes version-selection guidance."
 },
 {
  "slug": "non-cpa-residential-lease-agreement-south-africa",
  "name": "Residential lease agreement — non-CPA",
  "price": 500,
  "tag": "Non-CPA version",
  "description": "Non-CPA residential lease agreement template for South African landlords. Price R500.",
  "intro": "A separate residential lease version intended for circumstances where the Consumer Protection Act does not apply.",
  "includes": [
   "Landlord, tenant and property schedules",
   "Rental, deposit and payment arrangements",
   "Term, occupation and responsibility fields",
   "Inspection references and special-conditions schedule",
   "Non-CPA provisions and version-selection instructions"
  ],
  "when": "A lease needs to suit the parties, property and transaction. Choose the version that fits the transaction; the label does not determine which legislation applies.",
  "faq": "Will one lease suit every landlord?",
  "answer": "This version is intended only for circumstances where the CPA does not apply. Do not choose solely on whether the applicant is an individual or an entity; confirm suitability before use."
 },
 {
  "slug": "inspection-template-pack-south-africa",
  "name": "Incoming + outgoing inspection pack",
  "price": 349,
  "tag": "Two matching records",
  "description": "Incoming and outgoing rental inspection templates together for South African landlords. Price R349.",
  "intro": "Start and end the tenancy with matching condition records that are easy to compare.",
  "includes": [
   "Incoming inspection template",
   "Outgoing inspection template",
   "Consistent room and fixture categories",
   "Photo references, meter readings and key registers"
  ],
  "when": "Choose the pair when you want a consistent inspection format throughout the tenancy. Keep each completed report with the corresponding photographs and property records.",
  "faq": "Can I use the templates for more than one property?",
  "answer": "The pack can be reused for your own rental administration. Resale and redistribution are not included."
 },
 {
  "slug": "tenant-breach-notice-south-africa",
  "name": "Breach letter",
  "price": 390,
  "tag": "Record a concern",
  "description": "Tenant breach notice template for South African landlords. Explore fields for breach details, required remedy and delivery records.",
  "intro": "Describe the alleged breach, the requested remedy and the supporting records clearly.",
  "includes": [
   "Parties, property and lease-reference fields",
   "Alleged breach and supporting detail",
   "Required remedy and deadline fields",
   "Delivery details and record-keeping checklist"
  ],
  "when": "A breach notice needs to fit the signed lease and circumstances. Remedy periods and delivery requirements must be checked before sending. Check suitability for the specific lease before sending.",
  "faq": "Is a breach notice an eviction order?",
  "answer": "No. A notice is not an eviction order. Seek qualified advice for cancellation, eviction or disputed enforcement."
 },
 {
  "slug": "lease-cancellation-letter-south-africa",
  "name": "Cancellation of lease letter",
  "price": 390,
  "tag": "Record a cancellation",
  "description": "Cancellation of lease letter template for South African landlords. Price R390.",
  "intro": "Record the basis, effective date and delivery details of a proposed lease cancellation.",
  "includes": [
   "Landlord, tenant, property and original-lease details",
   "Grounds for cancellation and relevant prior-notice references",
   "Effective date and handover arrangements",
   "Delivery record and signature fields"
  ],
  "when": "Cancellation requirements depend on the lease and circumstances. Check the cancellation basis and whether any earlier notice requirements have been satisfied before use.",
  "faq": "Can this letter replace a breach notice?",
  "answer": "Do not assume the letters are interchangeable. Check the grounds, lease terms and applicable requirements with a qualified adviser before sending a cancellation letter."
 },
 {
  "slug": "lease-renewal-addendum-south-africa",
  "name": "Lease renewal addendum",
  "price": 299,
  "tag": "Extend an agreement",
  "description": "Lease renewal addendum template for South African landlords. Record agreed new dates, rental and changes to an existing lease.",
  "intro": "Record an agreed extension and changed terms while identifying the original lease.",
  "includes": [
   "Original lease and party details",
   "New start and end dates",
   "Revised rental and deposit fields",
   "Agreed changes and signature fields"
  ],
  "when": "Use a renewal addendum to document an agreed extension of an existing lease. Read it together with the original agreement and any earlier addendums.",
  "faq": "Does an addendum replace the original lease?",
  "answer": "The intended template identifies the original lease and records specific agreed changes. It should be read with the original documents, rather than treated as a standalone lease."
 },
 {
  "slug": "rental-application-form-south-africa",
  "name": "Rental application form — individual",
  "price": 199,
  "tag": "Individual applicants",
  "description": "Individual rental application form for South African landlords. Price R199.",
  "intro": "Bring applicant details, affordability information and references together before choosing a tenant.",
  "includes": [
   "Applicant and proposed occupant details",
   "Employment and income information",
   "Current accommodation and reference details",
   "Supporting-document checklist and consent fields"
  ],
  "when": "Use an application form when an interested tenant is ready to apply. It helps you request consistent information from each applicant; it does not replace verification or a credit check.",
  "faq": "Does an application guarantee a tenancy?",
  "answer": "No. An application records information for consideration. Keep the application process separate from the final lease agreement."
 },
 {
  "slug": "juristic-entity-rental-application-form-south-africa",
  "name": "Rental application form — juristic entity",
  "price": 199,
  "tag": "Juristic entity applicants",
  "description": "Juristic entity rental application form for South African landlords. Price R199.",
  "intro": "Collect entity, authorised representative, financial and reference details in one application.",
  "includes": [
   "Entity name, registration and registered-address details",
   "Authorised representative and authority-to-sign details",
   "Financial information and supporting-document checklist",
   "Business references, proposed occupants and consent fields"
  ],
  "when": "Use this version for an application by a juristic entity. Verify the entity details, signatory authority and supporting information separately; the application does not replace a signed lease.",
  "faq": "Is this the same as the individual application?",
  "answer": "No. This version requests entity and authorised-representative information. The individual version is a separate R199 product."
 }
]
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const base='/landlord-documents'
const href=p=>`${base}/${p.slug}/`
const head=(title,description,path)=>`<!doctype html><html lang="en-ZA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | MyRental SA</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${origin}${path}"><meta property="og:title" content="${escape(title)} | MyRental SA"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}${path}"><meta name="theme-color" content="#142b43"><link rel="stylesheet" href="${base}/shop.css"></head><body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="${base}/">MyRental <span>SA</span></a><nav aria-label="Main"><a href="${base}/">Documents</a><a class="button secondary" href="/">Open the app ↗</a></nav></header>`
const foot=`<footer><strong>MyRental SA</strong><p>Practical paperwork. Better rental records.</p><a href="/privacy.html">Privacy policy</a> · <a href="/">Rental management app</a><p class="small">Templates provide general starting points, not advice tailored to your circumstances.</p></footer></body></html>`
const card=p=>`<a class="card" href="${href(p)}"><span class="tag">${p.tag}</span><span class="file" aria-hidden="true">≡</span><h3>${p.name}</h3><p>${p.intro}</p><div class="card-bottom"><strong>R${p.price}</strong><span>View document →</span></div></a>`
const status=`<aside class="notice"><strong>Document downloads · once-off purchases</strong><p>Browse the collection and prices. Pay securely through PayFast. Your download unlocks after payment confirmation. No app subscription is required.</p></aside>`
export async function buildShop(output='public'){
 const root=resolve(output,'landlord-documents');await mkdir(root,{recursive:true})
 const catalogue=head('Landlord Documents & Rental Templates South Africa','Explore South African landlord documents: rental applications, residential leases, inspection forms, renewal addendums and breach notices.',base+'/')+`<main id="main"><section class="hero"><div><p class="eyebrow">FOR SOUTH AFRICAN PRIVATE LANDLORDS</p><h1>Your rental paperwork,<br><em>all in one place.</em></h1><p class="lead">From the first application to the final handover. Explore a practical collection of landlord forms, agreements and inspection templates.</p><a class="button" href="#collection">Explore the documents ↓</a></div><div class="hero-paper"><span>MYRENTAL SA / DOCUMENT COLLECTION</span><h2>A more organised<br>start to every tenancy.</h2><ul><li>Application & screening</li><li>Lease & renewal</li><li>Inspections & handover</li><li>Notices & records</li></ul><small>Editable Word + printable PDF</small></div></section>${status}<section id="collection"><div class="section-head"><p class="eyebrow">BUILD YOUR LANDLORD FILE</p><h2>Find the document you need.</h2><p>Individual prices below. Incoming and outgoing inspection templates are R349 as a pair. CPA and non-CPA leases are R500 per version. Application forms are R199 per version.</p></div><div class="grid">${products.map(card).join('')}</div></section><section class="app-promo"><p class="eyebrow">MORE THAN PAPERWORK</p><h2>Keep the whole property organised.</h2><p>Use the MyRental SA app to manage property records, payments, maintenance and the next steps in your rental journey.</p><a class="button secondary" href="/">Explore the rental management app ↗</a></section></main>`+foot
 await writeFile(resolve(root,'index.html'),catalogue)
 for(const p of products){const path=href(p);const json={ '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Landlord documents',item:origin+base+'/'},{'@type':'ListItem',position:2,name:p.name,item:origin+path}]};const html=head(p.name+' South Africa',p.description,path)+`<main id="main"><div class="breadcrumbs"><a href="${base}/">Landlord documents</a> / ${p.name}</div><section class="product"><div><p class="eyebrow">${p.tag.toUpperCase()} · SOUTH AFRICA</p><h1>${p.name}</h1><p class="lead">${p.intro}</p><p class="price">R${p.price} <small>Once-off price</small></p><p class="availability">Word + PDF files · no subscription</p><a class="button" href="${base}/checkout/?product=${p.slug}">Buy for R${p.price} →</a> <a href="#contents">View contents</a></div><div class="hero-paper"><span>MYRENTAL SA / COLLECTION PREVIEW</span><h2>${p.name}</h2><p>Document contents</p><ul>${p.includes.map(x=>`<li>${x}</li>`).join('')}</ul><small>Contents overview only — this is not a downloadable document sample.</small></div></section>${status}<section class="detail-grid" id="contents"><article><h2>What’s included</h2><ul class="contents">${p.includes.map(x=>`<li>${x}</li>`).join('')}</ul><h2>When to use it</h2><p>${p.when}</p><h2>Download formats</h2><p>Your ZIP download includes editable Word files, printable PDFs and the document selection guide. These are working templates to complete and adapt to your circumstances.</p></article><aside class="detail-aside"><h2>Before you buy</h2><p>This is a once-off purchase of the listed files, separate from app membership. Read the purchase terms at checkout. Files remain private until payment is confirmed.</p><p>Check that the chosen template suits your property, parties and circumstances.</p><a href="${base}/">Browse all landlord documents →</a></aside></section><section class="faq"><h2>Common questions</h2><details><summary>${p.faq}</summary><p>${p.answer}</p></details><details><summary>How do I get my files?</summary><p>Complete PayFast payment and return to the download page in the same browser. Keep your order reference. Access lasts 30 days.</p></details><details><summary>Can I manage my property in the meantime?</summary><p>Yes. <a href="/">Open MyRental SA</a> to sign in or explore account registration. App membership is separate from the document shop.</p></details></section><section><h2>Related landlord documents</h2><div class="grid">${products.filter(x=>x.slug!==p.slug).slice(p.slug.includes('inspection')?1:0,p.slug.includes('inspection')?4:3).map(card).join('')}</div></section></main><script type="application/ld+json">${JSON.stringify(json).replaceAll('<','\\u003c')}</script>`+foot;await mkdir(resolve(root,p.slug),{recursive:true});await writeFile(resolve(root,p.slug,'index.html'),html)}
 const checkout=head('Secure Document Checkout','Purchase MyRental SA document downloads with a once-off PayFast payment.',base+'/checkout/')+`<main id="main" class="checkout-wrap"><p class="eyebrow">MYRENTAL SA DOCUMENTS</p><h1>Secure document checkout</h1><p id="message" role="status" aria-live="polite"></p><form id="purchase-form"><h2 id="product-title">Your document</h2><p id="product-price" class="price"></p><label for="buyer-name">Your full name<input id="buyer-name" name="name" autocomplete="name" maxlength="100" required></label><label for="buyer-email">Your email address<input id="buyer-email" name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="consent"><input id="terms" type="checkbox" required><span>I have read the purchase terms below and understand that I am buying editable working templates, with delivery after payment confirmation.</span></label><button class="button" type="submit">Continue to PayFast →</button><p class="small">Once-off payment. No recurring subscription. Keep this browser open for your download.</p></form><section id="purchase-status" hidden><h2>Your purchase</h2><p id="order-state"></p><p>Order reference: <strong id="order-ref"></strong></p><button id="refresh" class="button secondary" type="button">Check payment status</button> <button id="download" class="button" type="button" hidden>Download Word and PDF files</button></section><section class="purchase-terms"><h2>Document purchase terms</h2><p>The displayed rand price is the total once-off charge for the selected ZIP package. MyRental SA supplies the listed Word and PDF files with a selection guide. App membership is separate.</p><p>The files are editable working templates. Complete all relevant fields and select the correct version; no template guarantees suitability or a particular outcome. The purchase grants reuse for your own rental administration, not resale or redistribution.</p><p>After verified payment, download access is available here for 30 days in the same browser. Save the files locally. Email delivery is not currently included. Keep the order reference for any payment or delivery query.</p><p>If files are missing, corrupted or do not match the listed product, report the order reference through MyRental SA support. Mandatory consumer rights, including any applicable cancellation or refund rights, remain unaffected. There is no blanket waiver of those rights.</p><p>We process your name, email and order reference to administer the purchase. Card or bank details are handled by PayFast. See our <a href="/privacy.html">privacy policy</a>.</p><a href="${base}/">Back to documents</a></section></main><script>window.documentProducts=${JSON.stringify(products.map(({slug,name,price})=>({slug,name,price}))).replaceAll('<','\\u003c')}</script><script src="${base}/checkout.js" defer></script>`+foot;await mkdir(resolve(root,'checkout'),{recursive:true});await writeFile(resolve(root,'checkout','index.html'),checkout.replace('<meta name="description"','<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="description"'))
 const urls=[base+'/',...products.map(href)];await writeFile(resolve(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(x=>`<url><loc>${origin}${x}</loc></url>`).join('')}</urlset>`)
 await writeFile(resolve(output,'robots.txt'),`User-agent: *\nAllow: /landlord-documents/\nDisallow: /admin\nDisallow: /request-deletion\nSitemap: ${origin}/sitemap.xml\n`)
}
if(process.argv[1]===new URL(import.meta.url).pathname)await buildShop()
