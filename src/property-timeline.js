export function propertyTimeline(property,data){
 const events=[],add=(kind,id,date,title,detail,tab)=>{if(date)events.push({key:`${kind}:${id}`,kind,date,title,detail,tab})}
 for(const lease of property.leases||[])add('Lease',lease.id,lease.start_date||lease.created_at,'Lease started',`${lease.tenant_name||'Tenant'} · ${lease.end_date||'Ongoing'}`,'Leases')
 for(const term of data.terms||[])add('Lease',`term-${term.id}`,term.recorded_at,'Lease terms recorded',`${term.tenant_name||'Tenant'} · R${Number(term.monthly_rent||0).toFixed(2)}/month`,'Leases')
 for(const record of data.renewals||[])add('Renewal',record.id,record.created_at,record.title,record.status,'Leases')
 for(const invoice of data.invoices||[]){add('Invoice',invoice.id,invoice.issue_date,invoice.invoice_number,`Rental period: ${invoice.rental_month}`,'Invoices');for(const payment of invoice.rental_invoice_payments||[])add('Payment',payment.id,payment.payment_date,'Payment received',`R${Number(payment.amount).toFixed(2)} · ${invoice.invoice_number}`,'Payments')}
 for(const payment of data.manual||[]){if(!(data.invoices||[]).some(i=>payment.description?.includes(i.invoice_number)))add('Payment',payment.id,payment.transaction_date,payment.description,`R${Number(payment.amount).toFixed(2)}`,'Payments')}
 for(const inspection of data.inspections||[])add('Inspection',inspection.id,inspection.inspection_date||inspection.created_at,`${inspection.inspection_type} inspection`,`${inspection.tenant_name||'Tenant not recorded'} · ${inspection.status}`,'Inspections')
 for(const item of data.maintenance||[]){add('Maintenance',item.id,item.created_at,item.issue,`${item.status} · ${item.responsibility}`,'Maintenance');if(item.updated_at&&item.updated_at!==item.created_at)add('Maintenance',`updated-${item.id}`,item.updated_at,'Maintenance updated',`${item.issue} · ${item.status}`,'Maintenance')}
 for(const doc of data.documents||[])add('Document',doc.id,doc.created_at,doc.title,doc.document_type==='Signed lease'?'Signed lease copy uploaded':doc.landlord_signed&&doc.tenant_signed?'Both signatures recorded':doc.document_type,doc.section==='leases'?'Leases':doc.section==='inspections'?'Inspections':doc.section==='maintenance'?'Maintenance':doc.section==='invoices'?'Invoices':'Accounts')
 return events.sort((a,b)=>b.date.localeCompare(a.date)||a.key.localeCompare(b.key))
}
