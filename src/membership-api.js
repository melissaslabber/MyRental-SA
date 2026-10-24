import { supabase } from './supabase'
let adminProof=''
export const lockAdmin=()=>{adminProof=''}
export async function unlockAdmin(password){const result=await membershipApi('admin_unlock',{password});adminProof=result.proof;return result.expiresAt}
export async function membershipApi(action='status',body={}){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw new Error('Sign in to continue.')
 const {data,error}=await supabase.functions.invoke('membership',{body:{...body,action,...(adminProof?{adminProof}:{})},headers:{Authorization:`Bearer ${session.access_token}`}})
 if(error){let message='Could not reach membership services. Please try again.';try{const result=await error.context.json();message=result.error||message}catch{}throw new Error(message)}
 if(data?.error)throw new Error(data.error)
 return data
}
export function openPayfast(checkout){
 if(!['https://www.payfast.co.za/eng/process','https://sandbox.payfast.co.za/eng/process'].includes(checkout.url))throw new Error('Invalid payment destination')
 const form=document.createElement('form');form.method='POST';form.action=checkout.url
 for(const [name,value] of Object.entries(checkout.fields)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.append(input)}document.body.append(form);form.submit()
}
