import {useEffect,useState} from 'react'
import {Admin} from './Admin'
import {unlockAdmin,lockAdmin} from './membership-api'
export function AdminGate({onClose}){
 const [expires,setExpires]=useState(0),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>()=>lockAdmin(),[])
 useEffect(()=>{if(!expires)return;const timer=setTimeout(()=>{lockAdmin();setExpires(0);setError('Admin access expired. Verify your password again.')},Math.max(0,expires-Date.now()));return()=>clearTimeout(timer)},[expires])
 const unlock=async e=>{e.preventDefault();setBusy(true);setError('');try{const until=await unlockAdmin(password);setPassword('');setExpires(until)}catch(e){setError(e.message)}finally{setPassword('');setBusy(false)}}
 const close=()=>{lockAdmin();setExpires(0);onClose()}
 return <section><div className="invoice-actions"><button className="secondary" onClick={close}>Lock and return to Settings</button></div>{expires>Date.now()?<Admin/>:<form className="invoice-settings" onSubmit={unlock}><span className="eyebrow">PRIVATE ADMINISTRATION</span><h2>Unlock administration</h2><p>Verify your MyRental SA account password. Admin access locks when you leave this area and after 15 minutes.</p><label>Account password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Verifying…':'Unlock admin tools'}</button></form>}</section>
}
