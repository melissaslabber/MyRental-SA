import {Component,useEffect,useState} from 'react'
import {supabase} from './supabase'
export class AppBoundary extends Component{
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 render(){if(!this.state.failed)return this.props.children;return <main className="auth-card"><h2>Let’s get you back to your rentals</h2><p>This screen could not finish loading. Your saved records remain available.</p><button className="primary" onClick={()=>{localStorage.setItem('myrental_last_page','Today');window.location.reload()}}>Return to overview</button></main>}
}
export function ConnectionNotice(){
 const [online,setOnline]=useState(()=>navigator.onLine)
 useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change)}},[])
 return online?null:<div className="connection-notice" role="status">You’re offline. Reconnect before saving or downloading private files. Device drafts remain on this device.</div>
}
export function PasswordRecovery({onDone}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 const save=async e=>{e.preventDefault();setError('');if(password!==confirm){setError('The passwords do not match.');return}setBusy(true);try{const r=await supabase.auth.updateUser({password});if(r.error)throw r.error;setPassword('');setConfirm('');setSaved(true)}catch(e){setError(e.message||'Could not update your password. Request a new reset link if it expired.')}finally{setBusy(false)}}
 return <div className="auth-shell"><section className="auth-card"><h2>{saved?'Password updated':'Set a new password'}</h2>{saved?<><p>Use your new password to sign in. The private administration area uses this same account password.</p><button className="primary" onClick={async()=>{await supabase.auth.signOut({scope:'local'});onDone()}}>Return to sign in</button></>:<form onSubmit={save}><label>New password<input required autoComplete="new-password" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input required autoComplete="new-password" type="password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Updating…':'Save new password'}</button></form>}</section></div>
}
