import * as PDFLib from 'npm:pdf-lib@1.17.1'
import {Buffer} from 'node:buffer'
import {invoiceTotals,friendlyReminder,monthText,rentalPdf} from '../../../shared/rental-documents.js'
const dbCheck=async(q:any)=>{const r=await q;if(r.error)throw new Error('Rental records could not be saved. Refresh before trying again.');return r.data}
const fail=(message:string,code=400)=>{throw Object.assign(new Error(message),{status:code})}
const day=(month:string,n:number)=>{const [year,m]=month.split('-').map(Number);return `${month.slice(0,7)}-${String(Math.min(n,new Date(Date.UTC(year,m,0)).getUTCDate())).padStart(2,'0')}`}
async function settings(db:any,user:string,property:string){const s=await dbCheck(db.from('rental_invoice_settings').select('*').eq('property_id',property).eq('owner_id',user).single());if(!s?.landlord_name)fail('Save landlord and invoice details for this property first.');return s}
async function invoiceBundle(db:any,user:string,id:string){const i=await dbCheck(db.from('rental_invoices').select('*,rental_invoice_lines(*),rental_invoice_payments(*)').eq('owner_id',user).eq('id',id).single());if(!i)fail('Invoice not found',404);return i}
async function generate(db:any,user:string,body:any){
 if(!/^\d{4}-\d{2}-01$/.test(body.month||''))fail('Choose a rental month.')
 const s=await settings(db,user,body.propertyId),lease=await dbCheck(db.from('leases').select('*').eq('owner_id',user).eq('property_id',body.propertyId).eq('status','active').order('created_at',{ascending:false}).limit(1).single())
 if(!lease?.tenant_name)fail('Add an active lease and tenant details first.')
 if(lease.start_date>day(body.month,31)||lease.lease_type==='fixed'&&lease.end_date<body.month)fail('The active lease does not cover this rental month. Update or renew the lease first.')
 const kind=body.kind==='supplement'?'supplement':'monthly'
 const lines=body.lines||[{kind:'rent',label:'Rent · '+monthText(body.month),amount:Number(lease.monthly_rent)},...(s.recurring_extras||[]).filter((l:any)=>Number(l.amount)>0).map((l:any)=>({...l,kind:'service'}))]
 if(!Array.isArray(lines)||lines.length>40||!lines.length||lines.some((l:any)=>!['rent','service'].includes(l.kind)||typeof l.label!=='string'||!l.label.trim()||l.label.length>120||!Number.isFinite(Number(l.amount))||Number(l.amount)<=0||Number(l.amount)>1e9))fail('Check the invoice descriptions and amounts.')
 return await dbCheck(db.rpc('rental_create_invoice',{p_owner:user,p_property:body.propertyId,p_month:body.month,p_issue:body.issueDate||new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}),p_due:body.dueDate||day(body.month,s.due_day),p_landlord:s,p_tenant:{name:lease.tenant_name,email:lease.tenant_email,phone:lease.tenant_phone,cpa_status:lease.cpa_status,lease_type:lease.lease_type,start_date:lease.start_date,end_date:lease.end_date},p_lines:lines,p_kind:kind}))
}
async function dispatch(db:any,c:any,invoice:any,kind:string,recipient:string,APP:string){
 if(!c.RESEND_API_KEY||!c.EMAIL_FROM)fail('The administrator must configure the email service. You can still download and share the PDF manually.',503)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient||''))fail('Add a valid recipient email address to the lease or account.')
 await dbCheck(db.from('rental_invoice_dispatches').upsert({invoice_id:invoice.id,kind},{onConflict:'invoice_id,kind',ignoreDuplicates:true}))
 const record=await dbCheck(db.from('rental_invoice_dispatches').select('*').eq('invoice_id',invoice.id).eq('kind',kind).single())
 if(record.status==='sent')return {alreadySent:true}
 if(record.attempts>=3)fail('Delivery needs an administrator review; use manual PDF sharing.',409)
 if(record.attempts>0&&Date.now()-Date.parse(record.created_at)>23*3600000)fail('Delivery confirmation expired; review before resending.',409)
 if(record.status==='sending'&&Date.now()-Date.parse(record.locked_at)<600000)fail('Delivery is still being confirmed.',409)
 const claim=await dbCheck(db.from('rental_invoice_dispatches').update({status:'sending',attempts:record.attempts+1,locked_at:new Date().toISOString()}).eq('id',record.id).eq('status',record.status).eq('attempts',record.attempts).select('id').maybeSingle());if(!claim)return {inProgress:true}
 try{
  const totals=invoiceTotals(invoice),owner=kind==='owner_overdue'
  const subject=owner?'MyRental SA: outstanding rental needs your attention':kind==='friendly_reminder'?`Friendly payment reminder · ${invoice.invoice_number}`:`Rental invoice · ${monthText(invoice.rental_month)} · ${invoice.invoice_number}`
  const text=owner?`Your records show R${totals.balance.toFixed(2)} still outstanding for ${invoice.property_name}, invoice ${invoice.invoice_number}, due ${invoice.due_date}. Check your bank and record any full or partial payments before contacting the tenant. Open the invoice and arrears guide in MyRental SA. No breach letter, cancellation or eviction notice has been sent automatically.\n\n${APP}/`:kind==='friendly_reminder'?friendlyReminder(invoice):`Hi ${invoice.tenant_details?.name||'there'},\n\nPlease find your rental invoice for ${monthText(invoice.rental_month)} attached. The amount invoiced is R${totals.total.toFixed(2)}, due on ${invoice.due_date}. Please use the payment reference shown on the invoice.\n\nThank you,\n${invoice.landlord_details.landlord_name}`
  const bytes=owner?null:await rentalPdf(invoice,PDFLib)
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'myrental-rent/'+record.id},body:JSON.stringify({from:c.EMAIL_FROM,to:[recipient],...(invoice.landlord_details.landlord_email?{reply_to:invoice.landlord_details.landlord_email}:{}),subject,text,...(bytes?{attachments:[{filename:invoice.invoice_number+'.pdf',content:Buffer.from(bytes).toString('base64')}]}:{})}),signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw new Error('Email provider did not accept the request')
  const result=await response.json();await dbCheck(db.from('rental_invoice_dispatches').update({status:'sent',sent_at:new Date().toISOString(),provider_id:result.id,last_error:null}).eq('id',record.id))
  return {sent:true}
 }catch(e){await db.from('rental_invoice_dispatches').update({status:'failed',last_error:'Delivery could not be confirmed. Review before resending.'}).eq('id',record.id);throw e}
}
export async function rentalAction(db:any,user:any,body:any,c:any,APP:string){
 if(body.action==='invoice_generate')return {id:await generate(db,user.id,body)}
 if(body.action==='invoice_payment'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date||'')||!Number.isFinite(Number(body.amount))||!Number.isFinite(Number(body.rentComponent))||!body.requestKey)fail('Check the payment date and allocation.')
  return {id:await dbCheck(db.rpc('rental_record_payment',{p_owner:user.id,p_invoice:body.invoiceId,p_date:body.date,p_amount:Number(body.amount),p_rent:Number(body.rentComponent),p_reference:String(body.reference||'').slice(0,150),p_request:body.requestKey}))}
 }
 if(body.action==='invoice_send'){
  if(body.confirmed!==true)fail('Confirm that you want to email this tenant.')
  const invoice=await invoiceBundle(db,user.id,body.invoiceId);const kind=body.kind==='friendly_reminder'?'friendly_reminder':'invoice';if(kind==='friendly_reminder'&&invoiceTotals(invoice).balance<=0)fail('This invoice is fully paid. No reminder is needed.')
  return await dispatch(db,c,invoice,kind,invoice.tenant_details?.email,APP)
 }
 fail('Unknown rental action')
}
export async function rentalScheduledJob(db:any,c:any,APP:string,memberAccess:(user:any)=>Promise<any>){
 if(!c.RESEND_API_KEY||!c.EMAIL_FROM)return {sent:0}
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}),month=today.slice(0,7)+'-01',date=Number(today.slice(-2));let sent=0
 for(let offset=0;offset<10000;offset+=50){
  const settingsPage=await dbCheck(db.from('rental_invoice_settings').select('*').order('property_id').range(offset,offset+49));if(!settingsPage.length)break
  for(const s of settingsPage){try{
   const u=await db.auth.admin.getUserById(s.owner_id);if(u.error||!(await memberAccess(u.data.user)).access)continue
   let invoice=await dbCheck(db.from('rental_invoices').select('*,rental_invoice_lines(*),rental_invoice_payments(*)').eq('property_id',s.property_id).eq('rental_month',month).eq('kind','monthly').maybeSingle())
   if(!invoice&&s.auto_email&&today>=day(month,s.send_day)){const id=await generate(db,s.owner_id,{propertyId:s.property_id,month});invoice=await invoiceBundle(db,s.owner_id,id)}
   if(invoice&&s.auto_email&&today>=day(month,s.send_day)){const r=await dispatch(db,c,invoice,'invoice',invoice.tenant_details?.email,APP);if(r.sent)sent++}
   const overdue=await dbCheck(db.from('rental_invoices').select('*,rental_invoice_lines(*),rental_invoice_payments(*)').eq('property_id',s.property_id).lt('due_date',today))
   for(const old of overdue)if(today>=day(old.rental_month,s.alert_day)&&invoiceTotals(old).balance>0){const r=await dispatch(db,c,old,'owner_overdue',u.data.user.email,APP);if(r.sent)sent++}
   if(sent>=20)return {sent}
  }catch{ /* durable dispatch records retain failures; next job retries safely */ }}
  if(settingsPage.length<50)break
 }
 return {sent}
}
