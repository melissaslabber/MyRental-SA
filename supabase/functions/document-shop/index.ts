import {createClient} from 'npm:@supabase/supabase-js@2.116.0'
import crypto from 'node:crypto'
import {Buffer} from 'node:buffer'
import {signature,safeEqual,notificationSignature,notificationParameterString} from './payfast.js'
import {validPayment,canDownload} from './rules.js'
const APP='https://myrental-sa.vercel.app',url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex')
const assert=(ok:unknown,msg:string,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status})}
async function query(q:any){const r=await q;if(r.error)throw Object.assign(new Error('Could not complete the request. Please try again.'),{status:503});return r.data}
async function creds(){const c=await query(db.rpc('document_shop_credentials'));assert(c.myrental_document_merchant_id&&c.myrental_document_merchant_key&&c.myrental_document_passphrase,'Checkout is unavailable.',503);return {id:c.myrental_document_merchant_id,key:c.myrental_document_merchant_key,pass:c.myrental_document_passphrase}}
async function authorisedOrder(id:string,token:string){assert(/^[0-9a-f-]{36}$/.test(id)&&/^[0-9a-f]{64}$/.test(token),'Purchase access is invalid.',403);const order=await query(db.from('document_shop_orders').select('*').eq('id',id).maybeSingle());assert(order&&safeEqual(order.access_hash,hash(token)),'Purchase access is invalid.',403);assert(Date.parse(order.access_expires_at)>Date.now(),'Download access has expired. Contact support with your order reference.',410);return order}
Deno.serve(async req=>{
 const origin=req.headers.get('origin'),headers={'Access-Control-Allow-Origin':APP,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'}
 const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{...headers,'Content-Type':'application/json'}})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return json({error:'Method not allowed'},405)
 try{
  const path=new URL(req.url).pathname
  if(path.endsWith('/webhook')){
   assert(req.headers.get('content-type')?.includes('application/x-www-form-urlencoded'),'Invalid notification',415)
   const raw=await req.text();assert(raw.length<32768,'Notification too large',413)
   const entries=[...new URLSearchParams(raw).entries()];assert(entries.length===new Set(entries.map(([k])=>k)).size&&entries.at(-1)?.[0]==='signature','Invalid notification')
   const f=Object.fromEntries(entries),c=await creds()
   assert(safeEqual(f.signature,notificationSignature(f,c.pass)),'Invalid notification',403)
   const order=await query(db.from('document_shop_orders').select('*').eq('id',f.m_payment_id).maybeSingle());assert(order&&validPayment(f,order,c.id),'Payment details do not match',403)
   const validation=await fetch('https://www.payfast.co.za/eng/query/validate',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:notificationParameterString(f),signal:AbortSignal.timeout(12000)})
   assert(validation.ok&&(await validation.text()).trim()==='VALID','Payment verification unavailable',503)
   if(order.status==='paid'){assert(order.provider_payment_id===f.pf_payment_id,'Payment reference conflict',409);return json({ok:true})}
   assert(order.status==='pending','Order cannot be fulfilled',409)
   const updated=await query(db.from('document_shop_orders').update({status:'paid',paid_at:new Date().toISOString(),provider_payment_id:f.pf_payment_id}).eq('id',order.id).eq('status','pending').select('id'))
   assert(updated.length===1,'Payment is already being processed; retry notification.',409)
   return json({ok:true})
  }
  assert(!origin||origin===APP,'Origin not allowed',403)
  const raw=await req.text();assert(raw.length<8192,'Request too large',413);const body=JSON.parse(raw)
  if(body.action==='checkout'){
   assert(body.acceptedTerms===true,'Accept the document purchase terms.')
   const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim()
   assert(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&name.length>=2&&name.length<=100,'Enter your name and a valid email address.')
   const c=await creds(),ip=crypto.createHmac('sha256',key).update(req.headers.get('x-forwarded-for')?.split(',')[0]||req.headers.get('cf-connecting-ip')||'unknown').digest('hex')
   const limit=await db.from('document_shop_orders').select('id',{count:'exact',head:true}).eq('ip_hash',ip).gte('created_at',new Date(Date.now()-3600000).toISOString());assert(!limit.error&&Number(limit.count)<12,'Too many payment attempts. Please try again later.',429)
   const product=await query(db.from('document_shop_packages').select('slug,title,price_cents,sha256,sale_enabled').eq('slug',String(body.slug||'')).maybeSingle());assert(product?.sale_enabled,'This document is not available for purchase.',409)
   const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex')
   await query(db.from('document_shop_orders').insert({id,slug:product.slug,package_sha256:product.sha256,amount_cents:product.price_cents,email,buyer_name:name,access_hash:hash(token),ip_hash:ip,terms_version:'documents-2026-10-26'}))
   const fields:any={merchant_id:c.id,merchant_key:c.key,return_url:APP+'/landlord-documents/checkout/?order='+id,cancel_url:APP+'/landlord-documents/checkout/?cancelled=1&order='+id,notify_url:url+'/functions/v1/document-shop/webhook',name_first:name.slice(0,50),email_address:email,m_payment_id:id,amount:(product.price_cents/100).toFixed(2),item_name:product.title.slice(0,100),item_description:'Once-off Word and PDF template download. No subscription.'}
   fields.signature=signature(fields,c.pass)
   return json({id,token,url:'https://www.payfast.co.za/eng/process',fields})
  }
  if(body.action==='status'||body.action==='download'){
   const order=await authorisedOrder(String(body.id||''),String(body.token||''))
   if(body.action==='status')return json({id:order.id,status:order.status,amount:order.amount_cents/100,slug:order.slug,expires:order.access_expires_at})
   assert(canDownload(order,hash(body.token)),'Payment has not been confirmed.',402)
   const file=await query(db.from('document_shop_packages').select('payload,filename,sha256').eq('slug',order.slug).single());assert(file.sha256===order.package_sha256,'Your purchased version needs a support check.',409)
   const bytes=Buffer.from(file.payload.replace(/^\\x/,''),'hex');assert(hash(bytes as any)===file.sha256,'File integrity check failed',503)
   return new Response(bytes,{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${file.filename}"`}})
  }
  return json({error:'Unknown request'},400)
 }catch(e:any){return json({error:e.status?e.message:'Could not complete the request. Please refresh or contact support.'},e.status||503)}
})
