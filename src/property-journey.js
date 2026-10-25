// Uploaded reports satisfy the workflow without changing the original draft or signature evidence.
export function hasUploadedInspection(property,{documents=[],inspections=[]}={},report=null){
 const lease=property.activeLease||{}
 return documents.some(d=>{
  if(d.section!=='inspections'||d.document_type!=='Inspection report')return false
  if(report&&d.linked_record_id===report.id)return true
  if(report&&report.inspection_type!=='ingoing')return false
  if(d.linked_record_id===lease.id&&lease.id)return true
  if(d.linked_record_id){
   const linked=inspections.find(i=>i.id===d.linked_record_id)
   return !report&&linked?.inspection_type==='ingoing'&&(linked.report_data?.leaseId===lease.id||(!linked.report_data?.leaseId&&linked.tenant_name===lease.tenant_name))
  }
  // Older simple uploads were saved to the property without a tenancy link.
  const date=d.document_date||d.created_at?.slice(0,10)
  const earliest=lease.start_date?new Date(`${lease.start_date}T12:00:00Z`):null
  if(earliest)earliest.setUTCDate(earliest.getUTCDate()-14)
  return Boolean(lease.id&&date&&(!earliest||date>=earliest.toISOString().slice(0,10))&&(!lease.end_date||date<=lease.end_date))
 })
}
export function propertyJourney(property,{inspections=[],invoices=[],documents=[]}={}){
 const lease=property.activeLease||{},hasTenant=Boolean(lease.id&&lease.tenant_name?.trim())
 const signed=documents.some(d=>d.section==='leases'&&(d.document_type==='Signed lease'||d.landlord_signed&&d.tenant_signed)&&(d.linked_record_id===lease.id||(d.term_from&&d.term_from===lease.start_date&&d.term_to===lease.end_date)))
 const earliest=lease.start_date?new Date(`${lease.start_date}T12:00:00Z`):null
 if(earliest)earliest.setUTCDate(earliest.getUTCDate()-14)
 const ingoing=hasUploadedInspection(property,{documents,inspections})||inspections.some(r=>r.inspection_type==='ingoing'&&r.status==='completed'&&(r.report_data?.leaseId===lease.id||(!r.report_data?.leaseId&&r.tenant_name===lease.tenant_name&&r.inspection_date&&(!earliest||r.inspection_date>=earliest.toISOString().slice(0,10))&&(!lease.end_date||r.inspection_date<=lease.end_date))))
 const invoiced=invoices.some(i=>i.tenant_details?.name===lease.tenant_name&&(!lease.start_date||i.rental_month>=lease.start_date.slice(0,7)+'-01')&&(!lease.end_date||i.rental_month<=lease.end_date))

 return [{id:'property',label:'Property details',done:Boolean(property.name&&property.address&&property.suburb),tab:'Contacts',action:'Review property details'},
 {id:'tenant',label:'Tenant and lease details',done:hasTenant,tab:'Contacts',action:'Add tenant and lease'},
 {id:'signed',label:'Signed lease copy',done:hasTenant&&signed,tab:'Leases',action:'Upload signed lease'},
 {id:'inspection',label:'Ingoing inspection',done:hasTenant&&ingoing,tab:'Inspections',action:'Complete ingoing inspection'},
 {id:'invoice',label:'First invoice',done:hasTenant&&invoiced,tab:'Invoices',action:'Create first invoice'}]
}
export function nextPropertyAction(property,data={},today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'})){
 if((property.rawStatus||property.status)==='archived')return {label:'View archived property',tab:'Contacts',detail:'Restore the property from Manage when needed.'}
 const lease=property.activeLease||{}
 if(!lease.id||!lease.tenant_name)return {label:'Add tenant and lease',tab:'Contacts',editLease:true,detail:'Keep the tenant’s details and rental terms together.'}
 const outstanding=(data.invoices||[]).find(i=>i.due_date<today&&(i.rental_invoice_lines||[]).reduce((n,l)=>n+Math.round(Number(l.amount)*100),0)>(i.rental_invoice_payments||[]).reduce((n,p)=>n+Math.round(Number(p.amount)*100),0))
 if(outstanding)return {label:'Review rent outstanding',tab:'Invoices',detail:`${outstanding.invoice_number} · due ${outstanding.due_date}`}
 const unfinished=(data.inspections||[]).find(i=>i.status!=='completed'&&!hasUploadedInspection(property,data,i)&&i.inspection_date&&i.inspection_date<=today)
 if(unfinished)return {label:'Complete inspection',tab:'Inspections',detail:`${unfinished.inspection_type} · ${unfinished.inspection_date}`}
 if(lease.status==='active'&&lease.end_date&&lease.end_date<=today)return {label:'Review lease expiry',tab:'Leases',detail:`Lease ended ${lease.end_date}. Confirm the next steps.`}
 const step=propertyJourney(property,data).find(s=>!s.done)
 return step?{label:step.action,tab:step.tab,detail:`Next setup step: ${step.label.toLowerCase()}.`}:{label:'View property activity',tab:'Timeline',detail:'Setup is complete. Keep payments and records up to date.'}
}
