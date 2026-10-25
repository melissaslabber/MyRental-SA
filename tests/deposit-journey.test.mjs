import test from 'node:test'
import assert from 'node:assert/strict'
import {amountCents,reconcileDeposit,depositStatement} from '../src/deposit-reconciliation.js'
import {nextPropertyAction,propertyJourney} from '../src/property-journey.js'
const property={id:'p',name:'Cottage',address:'Sample address',suburb:'Town',activeLease:{id:'l',tenant_name:'Example Tenant',start_date:'2026-10-01',end_date:'2027-09-30',status:'active'}}
test('deposit reconciliation uses cents and credits interest, top-ups and previous refunds once',()=>{
 const result=reconcileDeposit({held:'10000',topups:'500.10',interest:'125.25',priorRefunds:'1000',deductions:[{reason:'Agreed charge',amount:'250.30'}]})
 assert.equal(result.available,962535);assert.equal(result.refund,937505);assert.equal(result.shortfall,0)
 assert.equal(amountCents('0.10')+amountCents('0.20'),30)
 for(const value of ['-1','NaN','1e2','10.001','Infinity','1000000000'])assert.throws(()=>amountCents(value))
 assert.throws(()=>reconcileDeposit({held:10,priorRefunds:20}),/Previous refunds/)
 assert.throws(()=>reconcileDeposit({held:10,deductions:[{amount:1}]}),/Describe/)
})
test('deposit shortfall is separated from refundable money and evidence appears in the statement',()=>{
 const form={held:'100',status:'draft',deductions:[{reason:'Proposed repair',amount:'150',evidenceIds:['d1']}]}
 assert.equal(reconcileDeposit(form).refund,0);assert.equal(reconcileDeposit(form).shortfall,5000)
 const text=depositStatement(property,property.activeLease,form,[{id:'d1',title:'Repair receipt'}])
 assert(text.includes('Repair receipt'));assert(text.includes('not an automatic debt finding'));assert(text.includes('does not approve deductions or transfer money'))
})
test('property setup requires signed copies for the current lease and accepts pre-occupation inspection dates',()=>{
 const data={documents:[{section:'leases',linked_record_id:'old',landlord_signed:true,tenant_signed:true}],inspections:[{inspection_type:'ingoing',status:'completed',inspection_date:'2026-09-29',tenant_name:'Example Tenant'}],invoices:[]}
 let steps=propertyJourney(property,data);assert(!steps.find(s=>s.id==='signed').done);assert(steps.find(s=>s.id==='inspection').done)
 data.documents[0].linked_record_id='l';steps=propertyJourney(property,data);assert(steps.find(s=>s.id==='signed').done)
 data.inspections[0].tenant_name='Previous Tenant';assert(!propertyJourney(property,data).find(s=>s.id==='inspection').done)
})
test('next action prioritises real arrears, then incomplete setup; archived properties are labelled',()=>{
 assert(nextPropertyAction({...property,activeLease:null}).editLease)
 const invoice={invoice_number:'INV1',due_date:'2026-10-01',rental_invoice_lines:[{amount:100}],rental_invoice_payments:[]}
 assert.equal(nextPropertyAction(property,{invoices:[invoice]},'2026-10-25').tab,'Invoices')
 invoice.rental_invoice_payments.push({amount:100});assert.equal(nextPropertyAction(property,{invoices:[invoice]},'2026-10-25').label,'Upload signed lease')
 assert.equal(nextPropertyAction({...property,rawStatus:'archived'}).label,'View archived property')
})

test('a simply uploaded signed lease completes only its linked tenancy without inventing signature dates',()=>{
 const uploaded={section:'leases',document_type:'Signed lease',linked_record_id:'l',landlord_signed:false,tenant_signed:false,signed_on:null}
 assert(propertyJourney(property,{documents:[uploaded]}).find(s=>s.id==='signed').done)
 assert(!propertyJourney(property,{documents:[{...uploaded,linked_record_id:'previous-tenancy'}]}).find(s=>s.id==='signed').done)
 assert(!propertyJourney(property,{documents:[{...uploaded,document_type:'Lease agreement'}]}).find(s=>s.id==='signed').done)
})

test('uploaded inspection advances setup and suppresses its unfinished ingoing draft',()=>{
 const documents=[{section:'leases',document_type:'Signed lease',linked_record_id:'l'},{section:'inspections',document_type:'Inspection report',linked_record_id:'l'}]
 const inspections=[{id:'r',inspection_type:'ingoing',status:'draft',inspection_date:'2026-10-01',tenant_name:'Example Tenant'}]
 assert(propertyJourney(property,{documents,inspections}).find(s=>s.id==='inspection').done)
 assert.equal(nextPropertyAction(property,{documents,inspections},'2026-10-25').label,'Create first invoice')
 inspections.push({id:'later',inspection_type:'interim',status:'draft',inspection_date:'2026-10-20'})
 assert.equal(nextPropertyAction(property,{documents,inspections},'2026-10-25').label,'Complete inspection')
})
test('legacy property uploads count for current tenancy but old or other tenancy files do not',()=>{
 const doc={section:'inspections',document_type:'Inspection report',created_at:'2026-10-25T08:00:00Z'}
 const done=d=>propertyJourney(property,{documents:[d]}).find(s=>s.id==='inspection').done
 assert(done(doc));assert(!done({...doc,created_at:'2025-10-25T08:00:00Z'}));assert(!done({...doc,linked_record_id:'old-lease'}))
 assert(!done({...doc,document_type:'Photo'}))
})
test('upload linked to an inspection completes the step without requiring the draft to be completed',()=>{
 const inspections=[{id:'r',inspection_type:'ingoing',status:'draft',tenant_name:'Example Tenant',inspection_date:'2026-10-01'}]
 const documents=[{section:'inspections',document_type:'Inspection report',linked_record_id:'r'}]
 assert(propertyJourney(property,{documents,inspections}).find(s=>s.id==='inspection').done)
 assert.notEqual(nextPropertyAction(property,{documents,inspections},'2026-10-25').label,'Complete inspection')
})
