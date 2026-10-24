import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import { signature, safeEqual, notificationSignature, notificationParameterString, parameterString } from './payfast.js'
import {propertyPlans,planForHomes,selectedPlan} from '../../../shared/pricing.js'
import {issueAdminProof,validAdminProof} from './admin-proof.js'
import {submitAgentContact,sendAgentContacts} from './agents.ts'
import { rentalAction,rentalScheduledJob } from './rentals.ts'
import { periodEnd, nextBillingDate, publicSubscription, money, validNotification } from './rules.js'

const url=Deno.env.get('SUPABASE_URL')!, serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
const APP='https://myrental-sa.vercel.app'
const allowed=new Set([APP,'https://localhost','capacitor://localhost','http://localhost','http://terminal.local:4173','http://localhost:5173'])
const assert=(condition:unknown,message:string,status=400)=>{if(!condition)throw Object.assign(new Error(message),{status})}
const checked=async(query:any)=>{const r=await query;if(r.error)throw new Error('Database operation could not be completed');return r.data}
const setting=async()=>await checked(db.from('billing_settings').select('*').eq('id',true).single())
const aesKey=async()=>crypto.webcrypto.subtle.importKey('raw',await crypto.webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(serviceKey)),{name:'AES-GCM'},false,['encrypt','decrypt'])
async function encrypt(value:string){const iv=crypto.randomBytes(12);const bytes=await crypto.webcrypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(),new TextEncoder().encode(value));return Buffer.from(iv).toString('base64')+'.'+Buffer.from(bytes).toString('base64')}
async function decrypt(value:string){const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64')},await aesKey(),Buffer.from(data,'base64')))}
async function credentials(){const rows=await checked(db.from('billing_secrets').select('name,ciphertext'));const c:Record<string,string>={};for(const row of rows)c[row.name]=await decrypt(row.ciphertext);for(const name of ['PAYFAST_MERCHANT_ID','PAYFAST_MERCHANT_KEY','PAYFAST_PASSPHRASE','RESEND_API_KEY','EMAIL_FROM'])c[name]=Deno.env.get(name)||c[name]||'';return c}
const configured=(c:any)=>Boolean(c.PAYFAST_MERCHANT_ID&&c.PAYFAST_MERCHANT_KEY&&c.PAYFAST_PASSPHRASE)
async function provider(c:any,s:any,path:string,method='GET',payload:Record<string,string>={}){
 const headers:any={'merchant-id':c.PAYFAST_MERCHANT_ID,version:'v1',timestamp:new Date(Date.now()+7200000).toISOString().slice(0,19)+'+02:00'}
 headers.signature=signature(Object.fromEntries(Object.entries({...headers,...payload,passphrase:c.PAYFAST_PASSPHRASE}).sort(([a],[b])=>a.localeCompare(b))))
 const response=await fetch('https://api.payfast.co.za'+path+(s.sandbox?'?testing=true':''),{method,headers:{...headers,...(Object.keys(payload).length?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(Object.keys(payload).length?{body:new URLSearchParams(payload).toString()}:{}),signal:AbortSignal.timeout(12000)})
 const result=await response.json();assert(response.ok&&!['error','failed'].includes(result.status)&&!(result.code>=400),'PayFast could not confirm this request. Your billing record is preserved.',502);return result
}
async function audit(actor:string,action:string,subject:string,details:any={}){await checked(db.from('billing_audit').insert({actor_id:actor,action,subject_id:subject,details}))}
async function subscription(user:string){return await checked(db.from('billing_subscriptions').select('*').eq('user_id',user).order('created_at',{ascending:false}).limit(1).maybeSingle())}
async function isAdmin(user:string){return !!await checked(db.from('billing_admins').select('user_id').eq('user_id',user).maybeSingle())}
async function status(user:any,heartbeat=true){
 const [s,sub,admin]=await Promise.all([setting(),subscription(user.id),isAdmin(user.id)])
 // Heartbeats are server-controlled; members cannot set free/admin/active flags.
 await checked(db.from('billing_members').upsert({user_id:user.id,...(heartbeat?{last_seen_at:new Date().toISOString()}:{} )},{onConflict:'user_id',ignoreDuplicates:true}))
 if(heartbeat)await checked(db.from('billing_members').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id))
 const member=await checked(db.from('billing_members').select('free_access,suspended').eq('user_id',user.id).single())
 const access=admin||!member.suspended&&(!s.enabled||member.free_access||sub?.status==='active'&&!sub.cancel_requested_at&&Date.parse(sub.paid_through)>Date.now())
 const counted=await db.from('properties').select('id',{count:'exact',head:true}).eq('owner_id',user.id);assert(!counted.error,'Could not determine property pricing',503);const propertyCount=counted.count||0,requiredPlan=planForHomes(propertyCount)
 const pendingPlan=await checked(db.from('billing_plan_changes').select('new_amount,status').eq('user_id',user.id).eq('status','prepared').order('created_at',{ascending:false}).limit(1).maybeSingle())
 const c=await credentials()
 return {propertyCount,plans:propertyPlans,requiredAmount:requiredPlan.amount,pendingPlan, isAdmin:admin,enabled:s.enabled,sandbox:s.sandbox,amount:sub?.status==='active'?Number(sub.amount):requiredPlan.amount,access,freeAccess:member.free_access,suspended:member.suspended,subscription:publicSubscription(sub),checkoutReady:configured(c),refunds:await checked(db.from('billing_refunds').select('id,amount,status,created_at,processed_at').eq('user_id',user.id))}
}
async function webhook(req:Request){
 assert(req.headers.get('content-type')?.includes('application/x-www-form-urlencoded'),'Invalid content type',415)
 const raw=await req.text();assert(raw.length<32768,'Notification too large',413)
 const params=new URLSearchParams(raw),entries=[...params.entries()];assert(new Set(entries.map(([k])=>k)).size===entries.length,'Duplicate fields')
 assert(entries.at(-1)?.[0]==='signature','Signature must be the final field')
 const f=Object.fromEntries(entries),c=await credentials(),s=await setting();assert(configured(c),'Billing credentials unavailable',503)
 assert(validNotification(f,c.PAYFAST_MERCHANT_ID)&&safeEqual(f.signature,notificationSignature(f,c.PAYFAST_PASSPHRASE)),'Invalid notification')
 const host=s.sandbox?'sandbox.payfast.co.za':'www.payfast.co.za'
 const validation=await fetch(`https://${host}/eng/query/validate`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:notificationParameterString(f),signal:AbortSignal.timeout(10000)})
 assert(validation.ok&&(await validation.text()).trim()==='VALID','PayFast verification failed')
 const stamp=f.payment_date||f.date
 const paidAt=stamp?new Date(stamp.replace(' ','T')+(/Z$|[+-]\d\d:\d\d$/.test(stamp)?'':'+02:00')):new Date()
 assert(Number.isFinite(paidAt.getTime())&&paidAt.getTime()<=Date.now()+300000,'Invalid payment date')
 await checked(db.rpc('billing_apply_event',{p_reference:f.m_payment_id,p_provider:f.pf_payment_id,p_status:f.payment_status,p_amount:money(f.amount_gross),p_fee:f.amount_fee?money(f.amount_fee):null,p_net:f.amount_net?money(f.amount_net):null,p_paid_at:paidAt.toISOString(),p_paid_through:periodEnd(paidAt.toISOString()),p_token:f.token||null}))
 return {ok:true}
}
async function cancel(user:any,reason:string){
 assert(reason.trim().length>=5&&reason.length<=1000,'Please give a cancellation reason (5–1000 characters).')
 const sub=await subscription(user.id);assert(sub,'No subscription found',404)
 if(sub.status==='cancelled')return {ok:true}
 assert(sub.provider_token,'This payment is awaiting PayFast confirmation. Refresh its status or contact support; do not start another payment.',409)
 await checked(db.from('billing_subscriptions').update({cancel_requested_at:sub.cancel_requested_at||new Date().toISOString(),cancellation_reason:reason,status:'cancellation_pending'}).eq('id',sub.id))
 await provider(await credentials(),await setting(),`/subscriptions/${encodeURIComponent(sub.provider_token)}/cancel`,'PUT')
 await checked(db.rpc('billing_cancel_local',{p_id:sub.id,p_user:user.id,p_reason:reason}))
 return {ok:true,message:'Subscription cancelled. Access has stopped. Any eligible 48-hour refund request is now in review; this is not a refund confirmation.'}
}
async function adminData(body:any){
 const page=Math.max(1,Number(body.page)||1),perPage=50
 const auth=await db.auth.admin.listUsers({page,perPage});if(auth.error)throw new Error('Could not load sign-ups')
 const ids=auth.data.users.map(u=>u.id)
 const [subs,members,transactions,refunds,emails,config,summary]=await Promise.all([
 checked(db.from('billing_subscriptions').select('id,user_id,status,amount,first_paid_at,last_paid_at,paid_through,cancelled_at,cancel_requested_at,cancellation_reason,created_at').in('user_id',ids)),
 checked(db.from('billing_members').select('*').in('user_id',ids)),
 checked(db.from('billing_transactions').select('*,billing_subscriptions(user_id)').order('received_at',{ascending:false}).range((page-1)*50,page*50-1)),
 checked(db.from('billing_refunds').select('*').order('created_at',{ascending:false}).range((page-1)*50,page*50-1)),
 checked(db.from('billing_email_queue').select('id,user_id,kind,status,scheduled_at,sent_at,last_error').order('scheduled_at',{ascending:false}).limit(50)),setting(),checked(db.rpc('billing_summary'))])
 const c=await credentials()
 const deletionRequests=await checked(db.from('billing_deletion_requests').select('*').order('created_at',{ascending:false}).limit(100))
 const admins=await checked(db.from('billing_admins').select('user_id'))
 const agentRequests=await checked(db.from('agent_contact_requests').select('*').order('created_at',{ascending:false}).limit(100))
 return {agentRequests,deletionRequests,page,hasMore:auth.data.users.length===perPage,summary,users:auth.data.users.map(u=>({id:u.id,email:u.email,name:u.user_metadata?.full_name||'',isAdmin:admins.some(a=>a.user_id===u.id),signedUpAt:u.created_at,lastSignInAt:u.last_sign_in_at,confirmed:!!u.email_confirmed_at,...members.find(m=>m.user_id===u.id),subscriptions:subs.filter(s=>s.user_id===u.id)})),transactions,refunds,emails,settings:{...config,payfastReady:configured(c),emailReady:!!c.RESEND_API_KEY&&!!c.EMAIL_FROM}}
}
async function reminders(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'')
 const job=await checked(db.from('billing_job_keys').select('token').eq('id',true).single())
 assert(token&&safeEqual(token,job.token),'Invalid job credentials',401)
 const c=await credentials(),s=await setting();await sendAgentContacts(db,c);if(!s.enabled||!c.RESEND_API_KEY||!c.EMAIL_FROM)return {sent:0,configured:false}
 await rentalScheduledJob(db,c,APP,async user=>status(user,false))
 await checked(db.rpc('billing_plan_reminders'))
 const queue=await checked(db.rpc('billing_claim_emails'));let sent=0
 for(const item of queue){
  try{
   const u=await db.auth.admin.getUserById(item.user_id);if(u.error||!u.data.user?.email)throw new Error('Account unavailable')
   const member=await status(u.data.user,false),sub=member.subscription
   if(member.freeAccess||member.suspended||member.isAdmin||!u.data.user.email_confirmed_at||sub&& !['pending','failed'].includes(sub.status)){
    await checked(db.from('billing_email_queue').update({status:'skipped'}).eq('id',item.id));continue
   }
   const name=String(u.data.user.user_metadata?.full_name||'there').split(' ')[0].replace(/[<>&"']/g,'').slice(0,60)
   const text=`Hi ${name},\n\nYour MyRental SA subscription payment is still outstanding. You can sign in to review your payment status and continue setting up your rental account.\n\nYour selected membership is R${Number(sub?.amount||89).toFixed(2)} per month. Plans depend on the number of homes. If your bank already shows a charge, check payment status before starting another payment.\n\nContinue securely: ${APP}/\n\nMyRental SA`
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'myrental-reminder/'+item.id},body:JSON.stringify({from:c.EMAIL_FROM,to:[u.data.user.email],subject:'Your MyRental SA subscription payment',text}),signal:AbortSignal.timeout(12000)})
   if(!response.ok)throw new Error('Email provider rejected the request')
   await checked(db.from('billing_email_queue').update({status:'sent',sent_at:new Date().toISOString(),last_error:null}).eq('id',item.id));sent++
  }catch{await db.from('billing_email_queue').update({status:'failed',last_error:'Delivery could not be confirmed; idempotent retry pending'}).eq('id',item.id)}
 }
 return {sent}
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',cors:any={'Access-Control-Allow-Origin':allowed.has(origin)?origin:APP,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'}
 const respond=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return respond({error:'Method not allowed'},405)
 try{
  if(new URL(req.url).pathname.endsWith('/reminders'))return respond(await reminders(req))
  if(new URL(req.url).pathname.endsWith('/webhook'))return respond(await webhook(req))
  assert(!origin||allowed.has(origin),'Origin not allowed',403)
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');assert(jwt,'Sign in first',401)
  const {data,error}=await db.auth.getUser(jwt);assert(!error&&data.user,'Your session has expired. Sign in again.',401)
  const user=data.user!,body=await req.json(),action=body.action||'status'
  if(action==='status')return respond(await status(user))
  if(['invoice_generate','invoice_payment','invoice_send'].includes(action)){const member=await status(user);assert(member.access,'Membership access required',403);return respond(await rentalAction(db,user,body,await credentials(),APP))}
  if(action==='agent_contact'){const member=await status(user);assert(member.access,'Membership access required',403);return respond(await submitAgentContact(db,user,body,await credentials()))}
  if(action==='checkout'){
   const s=await setting(),c=await credentials();assert(s.enabled&&configured(c),'Subscriptions are not open yet.',503)
   assert(body.acceptedTerms===true&&body.confirmedAdult===true,'Confirm the subscription terms and that you are at least 18.')
   assert(user.email_confirmed_at,'Confirm your email before subscribing',403)
   const member=await status(user);assert(!member.freeAccess&&!member.isAdmin&&!member.suspended,'This account does not need or cannot start a subscription',409)
   const plan=selectedPlan(body.planAmount??member.requiredAmount,member.propertyCount);assert(Number(body.confirmedAmount)===plan.amount,'The plan price changed. Refresh and confirm the monthly amount.');
   const started=await checked(db.rpc('billing_begin_checkout',{p_user:user.id,p_amount:plan.amount,p_reference:'MRSA-'+crypto.randomUUID(),p_terms:'2026-10-property-tiers-v1'}));const sub=Array.isArray(started)?started[0]:started
   const full=String(user.user_metadata?.full_name||'Landlord').split(' ')
   const fields:any={merchant_id:c.PAYFAST_MERCHANT_ID,merchant_key:c.PAYFAST_MERCHANT_KEY,return_url:APP+'/?payment=return',cancel_url:APP+'/?payment=cancelled',notify_url:url+'/functions/v1/membership/webhook',name_first:full[0].slice(0,50),name_last:full.slice(1).join(' ').slice(0,50),email_address:user.email,m_payment_id:sub.payment_reference,amount:Number(plan.amount).toFixed(2),item_name:'MyRental SA monthly membership',item_description:'Monthly subscription. 48-hour money-back window on your first payment.',subscription_type:'1',billing_date:nextBillingDate(new Date().toISOString()),recurring_amount:Number(plan.amount).toFixed(2),frequency:'3',cycles:'0'}
   fields.signature=signature(fields,c.PAYFAST_PASSPHRASE)
   await audit(user.id,'checkout_prepared',user.id,{subscription:sub.id})
   return respond({url:`https://${s.sandbox?'sandbox':'www'}.payfast.co.za/eng/process`,fields})
  }
  if(action==='change_plan'){
   const member=await status(user),s=await setting(),c=await credentials();assert(s.enabled&&configured(c),'Subscriptions are not open yet.',503)
   assert(body.confirmed===true&&!member.isAdmin&&!member.freeAccess&&!member.suspended,'Confirm the monthly plan change.')
   const plan=selectedPlan(body.planAmount,member.propertyCount);assert(Number(body.confirmedAmount)===plan.amount,'Confirm the current plan price.')
   const sub=await subscription(user.id);assert(sub?.status==='active'&&sub.provider_token&&!sub.cancel_requested_at,'Refresh your confirmed subscription first.')
   const prepared=await checked(db.rpc('billing_prepare_plan',{p_user:user.id,p_amount:plan.amount}));const change=Array.isArray(prepared)?prepared[0]:prepared
   const updated=await provider(c,s,`/subscriptions/${encodeURIComponent(sub.provider_token)}/update`,'PATCH',{amount:String(plan.amount*100)})
   assert(Number(updated?.data?.response?.amount)===plan.amount*100,'PayFast did not confirm the new amount. Retry the same plan; no extra charge is made.',502)
   await checked(db.rpc('billing_finish_plan',{p_id:change.id,p_user:user.id}))
   return respond({message:`Your next monthly recurring payment is R${plan.amount}. No additional payment was taken now.`})
  }
  if(action==='request_deletion'){
   assert(body.confirmed===true,'Confirm your deletion request')
   await checked(db.from('billing_deletion_requests').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true}))
   const sub=await subscription(user.id)
   let billing='No recurring subscription was found.'
   if(sub&&sub.status!=='cancelled'){if(sub.provider_token){try{await cancel(user,'Account deletion requested');billing='Recurring billing has been cancelled.'}catch{billing='Recurring billing could not yet be confirmed cancelled. The administrator must resolve it before completing deletion.'}}else billing='A payment is awaiting confirmation. The administrator must check it before completing deletion.'}
   await audit(user.id,'account_deletion_requested',user.id)
   return respond({ok:true,message:'Your deletion request is recorded for review. '+billing+' This is not confirmation that your account or data has been deleted.'})
  }
  if(action==='cancel')return respond(await cancel(user,String(body.reason||'')))
  assert(await isAdmin(user.id),'Administrator access required',403)
  if(action==='admin_unlock'){
   assert(typeof body.password==='string'&&body.password.length>0&&body.password.length<1000,'Enter your account password.')
   const verification=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
   const verified=await verification.auth.signInWithPassword({email:user.email!,password:body.password})
   assert(!verified.error&&verified.data.user?.id===user.id,'Password could not be verified. Please try again.',401)
   if(verified.data.session)await verification.auth.signOut({scope:'local'})
   return respond(issueAdminProof(user.id,serviceKey))
  }
  assert(validAdminProof(body.adminProof,user.id,serviceKey),'Admin area locked. Verify your password in Settings.',403)

  if(action==='agent_contact_status'){assert(['New','Contacted','Closed'].includes(body.status),'Choose a contact status');await checked(db.from('agent_contact_requests').update({contact_status:body.status}).eq('id',body.id));return respond({ok:true})}
  if(action==='admin')return respond(await adminData(body))
  if(action==='configure'){
   const updates=body.credentials||{};const validNames=['PAYFAST_MERCHANT_ID','PAYFAST_MERCHANT_KEY','PAYFAST_PASSPHRASE','RESEND_API_KEY','EMAIL_FROM']
   for(const name of validNames)if(typeof updates[name]==='string'&&updates[name].trim()){assert(updates[name].length<1000&&!/[\r\n]/.test(updates[name]),'Invalid credential value');await checked(db.from('billing_secrets').upsert({name,ciphertext:await encrypt(updates[name].trim()),updated_at:new Date().toISOString()}))}
   const c=await credentials();assert(!body.enabled||configured(c),'Add your PayFast merchant ID, key and passphrase before enabling checkout.')
   assert(typeof body.enabled==='boolean'&&typeof body.sandbox==='boolean','Choose the checkout settings')
   await checked(db.from('billing_settings').update({enabled:body.enabled,sandbox:body.sandbox,updated_at:new Date().toISOString()}).eq('id',true))
   await audit(user.id,'billing_settings_updated',user.id,{enabled:body.enabled,sandbox:body.sandbox})
   return respond({ok:true})
  }
  if(action==='member_access'){
   assert(typeof body.userId==='string'&&typeof body.freeAccess==='boolean'&&typeof body.suspended==='boolean','Invalid access settings')
   assert(body.userId!==user.id,'You cannot change your own admin access')
   const exists=await db.auth.admin.getUserById(body.userId);assert(!exists.error,'Member not found',404)
   await checked(db.from('billing_members').upsert({user_id:body.userId,free_access:body.freeAccess,suspended:body.suspended}))
   await audit(user.id,'member_access_updated',body.userId,{freeAccess:body.freeAccess,suspended:body.suspended})
   return respond({ok:true})
  }
  if(action==='refund_record'){
   assert(['processed','declined'].includes(body.status),'Invalid refund status')
   assert(body.status!=='processed'||String(body.reference||'').trim().length>=3,'Enter the actual PayFast refund reference. This action does not issue money.')
   const refund=await checked(db.from('billing_refunds').update({status:body.status,provider_reference:String(body.reference||'').slice(0,150),notes:String(body.notes||'').slice(0,1000),processed_at:new Date().toISOString()}).eq('id',body.id).eq('status','review_required').select().single())
   await audit(user.id,'refund_record_updated',refund.user_id,{id:refund.id,status:body.status})
   return respond({ok:true})
  }
  return respond({error:'Unknown action'},400)
 }catch(e:any){console.error('membership request failed',e.status||500);return respond({error:e.status?e.message:'This request could not be completed. Please refresh or contact support before retrying a payment.'},e.status||503)}
})
