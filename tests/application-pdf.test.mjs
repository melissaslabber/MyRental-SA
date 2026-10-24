import test from 'node:test'
import assert from 'node:assert/strict'
import * as PDFLib from 'pdf-lib'
import {applicationPdf,applicationText} from '../src/application-pdf.js'
import {nextSteps} from '../src/next-steps.js'
test('blank property-specific application produces a real PDF with consent and signature spaces',async()=>{
 const property={name:'Sample Home',address:'Example street',suburb:'Sample Town'},form={rent:10000,deposit:15000,occupation_date:'2026-11-01',selectedExtras:['Water'],notes:'Return supporting documents securely'}
 const text=applicationText(property,form);assert.match(text,/Sample Home/);assert.match(text,/Water/);assert.match(text,/Applicant signature/);assert.match(text,/does not create a lease/)
 const bytes=await applicationPdf(property,form,PDFLib),pdf=await PDFLib.PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>1);assert.ok(bytes.length>1000)
})
test('new properties and saved leases receive relevant next actions',()=>{assert.equal(nextSteps('Property added','Today').actions[0][1],'Properties');assert.equal(nextSteps('Lease details saved','Properties').actions[0][1],'Inspections');assert.equal(nextSteps('Lease outcome and follow-up saved','Renewals').actions[1][1],'Inspections');assert.equal(nextSteps('Email wording copied','Applications'),null)})
