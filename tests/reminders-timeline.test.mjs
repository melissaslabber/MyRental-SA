import test from 'node:test'
import assert from 'node:assert/strict'
import {buildReminders} from '../src/reminders.js'
import {propertyTimeline} from '../src/property-timeline.js'
const property={id:'p1',name:'Test Cottage',leases:[{id:'l1',status:'active',start_date:'2026-01-01',end_date:'2026-11-30',tenant_name:'Test Tenant'}]}
const now=new Date('2026-10-25T08:00:00Z')
test('reminders exclude paid invoices, completed tasks and archived properties',()=>{
 const data={records:[{id:'r1',property_id:'p1',due_date:'2026-10-24',title:'Check roof',status:'Planned',record_type:'inspection'},{id:'r2',property_id:'p1',due_date:'2026-10-24',status:'Completed'}],invoices:[{id:'i1',property_id:'p1',due_date:'2026-10-01',rental_invoice_lines:[{amount:1000}],rental_invoice_payments:[{amount:1000}]}]}
 const result=buildReminders([property],data,now);assert.equal(result.length,2);assert.equal(result[0].title,'Check roof');assert(result[0].overdue);assert.equal(result[0].page,'Inspections')
 assert.equal(buildReminders([{...property,rawStatus:'archived'}],data,now).length,0)
})
test('signature and receipt follow-up resolves when both copies and signatures are recorded',()=>{
 const inspection={id:'s1',property_id:'p1',inspection_type:'ingoing',status:'completed',report_data:{receipt:{}}},data={inspections:[inspection]}
 assert(buildReminders([property],data,now).some(r=>r.kind==='Report follow-up'))
 inspection.report_data.receipt={landlordDate:'2026-10-25',tenantDate:'2026-10-25'};data.documents=[{section:'inspections',linked_record_id:'s1',landlord_signed:true,tenant_signed:true}]
 assert(!buildReminders([property],data,now).some(r=>r.kind==='Report follow-up'))
})
test('timeline contains dated payments once and routes each event to its section',()=>{
 const invoice={id:'i1',issue_date:'2026-10-01',rental_month:'2026-10-01',invoice_number:'INV-1',rental_invoice_payments:[{id:'receipt1',payment_date:'2026-10-02',amount:2000}]}
 const events=propertyTimeline(property,{invoices:[invoice],manual:[{id:'mirror',transaction_date:'2026-10-02',description:'Rent / INV-1',amount:2000}]})
 assert.equal(events.filter(e=>e.kind==='Payment').length,1);assert.equal(events[0].tab,'Payments');assert.equal(events[1].tab,'Invoices')
})
