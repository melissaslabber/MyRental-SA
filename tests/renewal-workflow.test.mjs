import test from 'node:test'
import assert from 'node:assert/strict'
import * as PDFLib from 'pdf-lib'
import {renewalEnd,addendumText,addendumPdf} from '../src/renewal-addendum.js'
import {outgoingMessage} from '../src/renewal-message.js'
test('renewal dates clamp month ends and include full calendar months',()=>{
 assert.equal(renewalEnd('2027-01-01',12),'2027-12-31')
 assert.equal(renewalEnd('2027-01-31',1),'2027-02-28')
 assert.equal(renewalEnd('2028-02-01',1),'2028-02-29')
 assert.equal(renewalEnd('2027-02-30',1),'')
})
test('addendum validates dates and deposit details and produces PDF with signature clauses',async()=>{
 const f={landlord:'Test Landlord',tenant:'Test Tenant',property:'Test home',originalStart:'2026-01-01',months:12,from:'2027-01-01',to:'2027-12-31',rent:10000,topUp:500,depositDue:'2027-01-01'}
 const text=addendumText(f);assert.match(text,/Landlord signature/);assert.match(text,/Tenant signature/);assert.match(text,/top-up, not the total deposit/)
 assert.throws(()=>addendumText({...f,to:'2027-12-30'}))
 assert.throws(()=>addendumText({...f,depositDue:''}))
 const pdf=await PDFLib.PDFDocument.load(await addendumPdf(text,PDFLib));assert.ok(pdf.getPageCount()>=1)
})
test('move-out checklist respects optional items and fair wear and tear',()=>{
 const text=outgoingMessage({tenant:'Test Tenant',property:'Test home',endDate:'2027-01-12',carpets:true,pets:true,garden:true,pool:true})
 assert.match(text,/professional carpet cleaning/);assert.match(text,/not automatically required/);assert.match(text,/fair wear and tear/);assert.match(text,/three days before/)
 const plain=outgoingMessage({property:'Test home',endDate:'2027-01-12'});assert.doesNotMatch(plain,/professional carpet cleaning|mow the grass|pool care/)
})
