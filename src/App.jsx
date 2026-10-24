import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'
import { MaintenanceModule as LiveMaintenance, RentalModule } from './Modules'
import { LEGAL_VERSION, LegalAcceptance, LegalPage } from './Legal'
import { ProfessionalHelp, SettingsModule } from './Support'
import { ApplicationModule } from './Applications'
import { InspectionModule } from './Inspections'
import { DocumentsModule } from './Documents'
import { RenewalsModule } from './Renewals'
import { LearnModule } from './Learn'
import { MaintenanceAdvice } from './MaintenanceAdvice'
import { AdminGate } from './AdminGate'
import {PropertyFinance} from './PropertyFinance'
import {Invoices} from './Invoices'
import {isNative} from './native'
import {nextSteps} from './next-steps'
import {planForHomes} from '../shared/pricing'
import {leaseExpiryAlerts} from './lease-alerts'
import {DeletionRequest} from './DeletionRequest'
import { MembershipBoundary, MembershipPanel } from './Membership'
import {
  AlertTriangle, Bell, BookOpen, Building2, CalendarDays, ChevronRight,
  ClipboardCheck, CreditCard, FilePenLine, Hammer, Home, KeyRound, LayoutGrid,
  Link2, Menu, Plus, Receipt, Search, ShieldCheck, UserRound, WalletCards, X
} from 'lucide-react'

const pages = ['Today','Properties','Rent','Maintenance','More','Applications','Inspections','Documents','Renewals','Finances','Learn','Legal','Professional help','Settings','Admin','Membership','Invoices']

const flows = [
  { icon: Search, title: 'Advertise & find a tenant', text: 'Prepare, advertise and screen fairly.' },
  { icon: UserRound, title: 'Rental application form', text: 'Create a property-specific form to email.' },
  { icon: FilePenLine, title: 'Create a lease', text: 'Build the right agreement step by step.' },
  { icon: ClipboardCheck, title: 'Complete inspections', text: 'Ingoing, interim and outgoing records.' },
  { icon: Hammer, title: 'Manage maintenance', text: 'Track issues, quotes and responsibility.' },
  { icon: CalendarDays, title: 'Renew or end a lease', text: 'Deadlines, addendums and notices.' },
]

function Brand() {
  return <div className="brand"><div className="brand-mark"><KeyRound size={19}/></div><div><strong>MyRental</strong><span>SA</span></div></div>
}

function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [hasProperty, setHasProperty] = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [startupError,setStartupError]=useState('')

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data,error }) => {
      if(error){setStartupError('We couldn’t restore your session. Please reload and try again.');setLoading(false);return}
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) { setProfile(null); setHasProperty(false); setLegalAccepted(false); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('properties').select('id').eq('owner_id', session.user.id).limit(1),
      supabase.from('legal_acceptances').select('id').eq('user_id',session.user.id).eq('document_version',LEGAL_VERSION).maybeSingle()
    ]).then(([profileResult, propertyResult,legalResult]) => {
      if(profileResult.error||propertyResult.error||legalResult.error){setStartupError('We couldn’t load your account. Please try again.');setLoading(false);return}
      setProfile(profileResult.data)
      setHasProperty(Boolean(propertyResult.data?.length))
      setLegalAccepted(Boolean(legalResult.data))
      setLoading(false)
    })
  }, [session])

  if (!supabaseConfigured) return <Dashboard demo />
  if(startupError)return <div className="auth-shell"><div className="auth-card loading-card"><Brand/><h2>Let’s try that again</h2><p role="alert">{startupError}</p><button className="auth-submit" onClick={()=>window.location.reload()}>Reload account</button></div></div>
  if (loading || session === undefined) return <LoadingScreen />
  if (!session) return <AuthScreen />
  if(window.location.pathname==='/request-deletion')return <div className="membership-shell"><DeletionRequest/><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
  if (!legalAccepted) return <LegalAcceptance user={session.user} onAccepted={()=>setLegalAccepted(true)}/>
  return <MembershipBoundary user={session.user}>{(membership,refreshMembership)=>
    !profile?.onboarding_complete || !hasProperty
      ? <Onboarding user={session.user} profile={profile} onComplete={(nextProfile)=>{setProfile(nextProfile);setHasProperty(true)}} />
      : <Dashboard user={session.user} profile={profile} membership={membership} refreshMembership={refreshMembership} onSignOut={()=>supabase.auth.signOut()} />
  }</MembershipBoundary>
}

function LoadingScreen() { return <div className="auth-shell"><div className="auth-card loading-card"><Brand/><div className="spinner"/><p>Preparing your rental dashboard…</p></div></div> }

function AuthScreen() {
  const [mode,setMode]=useState('login'); const [form,setForm]=useState({name:'',email:'',password:''}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const submit=async(e)=>{e.preventDefault();setBusy(true);setMessage('');
    const result=mode==='login' ? await supabase.auth.signInWithPassword({email:form.email,password:form.password}) : await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name},emailRedirectTo:window.location.origin}})
    if(result.error) setMessage(result.error.message); else if(mode==='signup'&&!result.data.session) setMessage('Check your email to confirm your account, then return to sign in.')
    setBusy(false)
  }
  const resetPassword=async()=>{if(!form.email){setMessage('Enter your email address first.');return}setBusy(true);setMessage('');const {error}=await supabase.auth.resetPasswordForEmail(form.email,{redirectTo:window.location.origin});setBusy(false);setMessage(error?error.message:'Password-reset email sent. Check your inbox.')}
  return <div className="auth-shell"><section className="auth-brand-panel"><Brand/><div><span className="eyebrow">PRIVATE LANDLORDS · SOUTH AFRICA</span><h1>Rent out with confidence.</h1><p>Every property, deadline and document—guided from advertising to deposit reconciliation.</p></div><small>Guidance and organisation for responsible landlords.</small></section><section className="auth-form-panel"><div className="auth-card"><span className="eyebrow">WELCOME TO MYRENTAL SA</span><h2>{mode==='login'?'Sign in to your account':'Create your landlord account'}</h2><p>{mode==='login'?'Continue managing your rentals.':'Create your account, confirm your email, then subscribe securely through PayFast. From R89 per month for 1–2 homes when subscriptions open; larger portfolios have higher tiers.'}</p><form onSubmit={submit}>{mode==='signup'&&!isNative()&&<label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></label>}<label>Email address<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>{mode==='login'&&<button type="button" className="forgot-link" onClick={resetPassword}>Forgot password?</button>}{message&&<div className="auth-message">{message}</div>}<button className="auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button></form>{isNative()&&<p className="native-signin-note">Sign in with your existing MyRental SA account.</p>}<a className="auth-policy" href="/privacy.html">Privacy policy</a> · <a className="auth-policy" href="/delete-account.html">Account deletion</a><button className="auth-switch" hidden={isNative()} onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'New to MyRental SA? Create an account':'Already registered? Sign in'}</button></div></section></div>
}

function Onboarding({user,profile,onComplete}) {
  const [step,setStep]=useState(1); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [data,setData]=useState({name:profile?.full_name||user.user_metadata?.full_name||'',phone:'',propertyName:'',address:'',suburb:'',province:'Western Cape',status:'occupied'})
  const finish=async()=>{setBusy(true);setError(''); const profileData={id:user.id,full_name:data.name,phone:data.phone,onboarding_complete:true};
    const {data:savedProfile,error:pError}=await supabase.from('profiles').upsert(profileData).select().single();
    if(pError){setError(pError.message);setBusy(false);return}
    const {error:propertyError}=await supabase.from('properties').insert({owner_id:user.id,name:data.propertyName,address:data.address,suburb:data.suburb,province:data.province,status:data.status});
    if(propertyError){setError(propertyError.message);setBusy(false);return} onComplete(savedProfile)
  }
  return <div className="onboarding-shell"><header className="onboarding-head"><Brand/><button onClick={()=>supabase.auth.signOut()}>Sign out</button></header><main className="onboarding-main"><div className="progress"><span style={{width:`${step*33.33}%`}}/></div><span className="eyebrow">STEP {step} OF 3</span>{step===1&&<div className="onboarding-step"><h1>Welcome to MyRental SA</h1><p>Let’s personalise your account before adding your first rental property.</p><label>Full name<input value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></label><label>Mobile number<input type="tel" value={data.phone} onChange={e=>setData({...data,phone:e.target.value})} placeholder="e.g. 082 123 4567"/></label></div>}{step===2&&<div className="onboarding-step"><h1>Add your first property</h1><p>This becomes the property’s secure digital file.</p><label>Property name<input value={data.propertyName} onChange={e=>setData({...data,propertyName:e.target.value})} placeholder="e.g. 14 Protea Lane"/></label><label>Street address<input value={data.address} onChange={e=>setData({...data,address:e.target.value})}/></label><div className="field-row"><label>Suburb / town<input value={data.suburb} onChange={e=>setData({...data,suburb:e.target.value})}/></label><label>Province<select value={data.province} onChange={e=>setData({...data,province:e.target.value})}>{['Western Cape','Eastern Cape','Northern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West'].map(x=><option key={x}>{x}</option>)}</select></label></div></div>}{step===3&&<div className="onboarding-step"><h1>What is its current status?</h1><p>We’ll create the correct starting checklist for you.</p><div className="choice-grid">{[['occupied','It has a tenant','Add the current lease and tenant'],['vacant','It is vacant','Prepare and advertise it'],['new','I just bought it','Set up the rental correctly']].map(([value,title,text])=><button className={data.status===value?'selected':''} onClick={()=>setData({...data,status:value})} key={value}><Building2/><b>{title}</b><small>{text}</small></button>)}</div></div>}{error&&<div className="auth-message">{error}</div>}<div className="onboarding-actions">{step>1&&<button className="secondary" onClick={()=>setStep(step-1)}>Back</button>}<button className="primary" disabled={busy||!data.name||(step===2&&(!data.propertyName||!data.address||!data.suburb))} onClick={()=>step<3?setStep(step+1):finish()}>{busy?'Saving…':step<3?'Continue':'Open my dashboard'} <ChevronRight size={17}/></button></div></main></div>
}

export function Dashboard({ user, profile, onSignOut, membership, refreshMembership, demo=false }) {
  const [page, setPage] = useState(()=>{const saved=window.location.pathname==='/admin'?'Admin':localStorage.getItem('myrental_last_page');return pages.includes(saved)?saved:'Today'})
  const [quick, setQuick] = useState(false)
  const [addingProperty,setAddingProperty] = useState(false)
  const [dataError,setDataError] = useState('')
  const [dataLoading,setDataLoading] = useState(!demo)
  const navigate=(next)=>{setPage(next);window.scrollTo({top:0,behavior:'instant'})}
  const openProperty=(property)=>{localStorage.setItem('myrental_open_property',property.id);navigate('Properties')}
  const [toast, setToast] = useState('')
  const [guidance,setGuidance]=useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [attention, setAttention] = useState([])
  const [attentionError,setAttentionError]=useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [alertClock,setAlertClock] = useState(()=>new Date())
  useEffect(()=>{const refresh=()=>setAlertClock(new Date());const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[])
  const leaseTasks=leaseExpiryAlerts(portfolio,alertClock).map(alert=>({icon:CalendarDays,title:alert.daysLeft<0?'Lease expired — follow up':`Lease expires in ${alert.daysLeft} ${alert.daysLeft===1?'day':'days'}`,detail:`${alert.propertyName} · ${alert.tenantName} · Ends ${new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${alert.endDate}T12:00:00`))}. Confirm whether the tenant wants to renew or move out. Record the agreed outcome and update the lease details.`,level:alert.daysLeft<=30?'urgent':'high',page:'Renewals',propertyId:alert.propertyId}))
  const allAttention=[...leaseTasks,...attention]
  const today = useMemo(() => new Intl.DateTimeFormat('en-ZA', { weekday:'long', day:'numeric', month:'long' }).format(new Date()), [])
  const notify = (message,meta={}) => { const next=nextSteps(message,page);if(next)setGuidance({...next,...meta});setToast(message); setTimeout(() => setToast(''), 2600) }

  useEffect(()=>{localStorage.setItem('myrental_last_page',page)},[page])
  useEffect(()=>{
    const onKey=(event)=>{if(event.key==='Escape'){setQuick(false);setAddingProperty(false)}}
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey)
  },[])
  useEffect(()=>{document.title=`${page==='Today'?'Overview':page} · MyRental SA`},[page])

  useEffect(() => {
    if (!profile?.id || !supabase) return
    setDataLoading(true);setDataError('')
    supabase.from('properties').select('*, leases(*)').eq('owner_id', profile.id).order('created_at', { ascending:false }).then(({data,error}) => {
      setDataLoading(false)
      if(error){setDataError('We couldn’t load your properties. Please try again.');return}
      setPortfolio((data||[]).map((p,index)=>{
        const activeLease=(p.leases||[]).find(l=>l.status==='active')||(p.leases||[])[0]
        return ({
        ...p,
        activeLease,
        area:p.suburb||p.province||'South Africa',
        tenant:activeLease?.tenant_name||(p.status==='occupied'?'Tenant details not added':'No current tenant'),
        rent:activeLease?.monthly_rent?`R${Number(activeLease.monthly_rent).toLocaleString('en-ZA')}`:p.monthly_rent?`R${Number(p.monthly_rent).toLocaleString('en-ZA')}`:'Not set',
        status:p.status==='occupied'?'Occupied':p.status==='vacant'?'Vacant':'New property',
        lease:activeLease?.end_date?new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${activeLease.end_date}T12:00:00`)):'Not set',
        tone:index%2?'sand':'sage'
      })}))
    })
  }, [profile?.id,refreshKey])

  useEffect(()=>{
    if(!profile?.id||!supabase)return
    Promise.all([
      supabase.from('rental_records').select('id,title,status,due_date,record_type,properties(name)').eq('owner_id',profile.id).not('due_date','is',null),
      supabase.from('maintenance_items').select('id,issue,status,urgent,properties(name)').eq('owner_id',profile.id).neq('status','Completed')
    ]).then(([records,maintenance])=>{
      setAttentionError(Boolean(records.error||maintenance.error))
      const now=new Date();now.setHours(0,0,0,0);const soon=new Date(now);soon.setDate(soon.getDate()+30)
      const recordItems=(records.data||[]).filter(r=>{const d=new Date(`${r.due_date}T12:00:00`);return d<=soon&&!['Completed','Declined','Refunded','Reconciled','Received'].includes(r.status)}).map(r=>{const d=new Date(`${r.due_date}T12:00:00`);const overdue=d<now;return {icon:CalendarDays,title:r.title,detail:`${r.properties?.name||'Rental record'} · ${overdue?'Overdue':`Due ${new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short'}).format(d)}`}`,level:overdue?'urgent':'high',page:r.record_type==='application'?'Applications':r.record_type==='inspection'?'Inspections':r.record_type==='finance'?'Finances':r.record_type==='renewal'?'Renewals':'Documents'}})
      const maintenanceItems=(maintenance.data||[]).filter(m=>m.urgent).map(m=>({icon:Hammer,title:m.issue,detail:`${m.properties?.name||'Property'} · ${m.status}`,level:'urgent',page:'Maintenance'}))
      setAttention([...maintenanceItems,...recordItems])
    })
  },[profile?.id,refreshKey,page])

  const nav = [
    ['Today', Home], ['Properties', Building2], ['Applications', UserRound], ['Finances', WalletCards], ['More', Menu]
  ]

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Main navigation"><span className="nav-label">YOUR WORKSPACE</span>{[...nav.slice(0,4),['Invoices',Receipt],['Maintenance',Hammer],['Inspections',ClipboardCheck],['Documents',FilePenLine],['Renewals',CalendarDays]].map(([name,Icon])=><button aria-current={page===name?'page':undefined} className={page===name?'active':''} onClick={()=>navigate(name)} key={name}><Icon size={19}/><span>{name==='Today'?'Overview':name==='Finances'?'Income & expenses':name}</span></button>)}<span className="nav-label">HELP & GUIDANCE</span>{[['Rent',KeyRound],['Learn',BookOpen],['More',Menu]].map(([name,Icon])=><button aria-current={page===name?'page':undefined} className={page===name?'active':''} onClick={()=>navigate(name)} key={name}><Icon size={19}/><span>{name==='Rent'?'Rental journey':name==='More'?'All tools & settings':name}</span></button>)}</nav>
      <div className="legal-mini"><ShieldCheck size={18}/><p><b>Guidance you can trust</b><br/>Important legal matters are clearly flagged for professional review.</p></div>
      <button className="profile" onClick={onSignOut}><span>{(profile?.full_name||'Landlord').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><div><b>{profile?.full_name?.split(' ')[0]||'Landlord'}</b><small>{demo?'Demo landlord':'Sign out'}</small></div></button>
    </aside>

    <a className="skip-link" href="#main-content">Skip to content</a>
    <main id="main-content">
      <header><div className="mobile-brand"><Brand/></div><div><p>{today}</p><h1>{page==='Today'?'Your rental overview':page==='Rent'?'Rental journey':page==='Finances'?'Income & expenses':page}</h1></div><button className="icon-btn" aria-label="View items needing attention" onClick={()=>{navigate('Today');requestAnimationFrame(()=>document.getElementById('attention')?.scrollIntoView({behavior:'smooth'}))}}><Bell size={21}/>{allAttention.length>0&&<i/>}</button></header>
      {dataError&&<div className="data-error" role="alert"><span>{dataError}</span><button className="secondary" onClick={()=>setRefreshKey(x=>x+1)}>Try again</button></div>}
      {dataLoading&&<div className="data-loading" role="status">Loading your portfolio…</div>}
      {guidance&&<section className="next-step-card no-print" aria-label="What to do next"><div className="sheet-head"><h2>{guidance.title}</h2><button aria-label="Dismiss next steps" onClick={()=>setGuidance(null)}><X size={18}/></button></div><ul>{guidance.tips.map(t=><li key={t}>{t}</li>)}</ul><div className="invoice-actions">{guidance.actions.map(([label,next])=><button className="secondary" key={label} onClick={()=>{if(next==='Properties'&&guidance.propertyId)localStorage.setItem('myrental_open_property',guidance.propertyId);setGuidance(null);navigate(next)}}>{label}<ChevronRight size={17}/></button>)}</div></section>}
      {page === 'Today'  && <Today setPage={navigate} setQuick={setQuick} properties={portfolio} tasks={allAttention} openProperty={openProperty} addProperty={()=>setAddingProperty(true)} loading={dataLoading} dataError={dataError} attentionError={attentionError} notify={notify}/>}
      {page === 'Properties' && <Properties onTenantNotice={id=>{localStorage.setItem('myrental_renewal_property',id);localStorage.setItem('myrental_tenant_notice',id);navigate('Renewals')}} notify={notify} properties={portfolio} ownerId={profile?.id} onRefresh={()=>setRefreshKey(x=>x+1)}/>}
      {page === 'Rent' && <LearnModule properties={portfolio} notify={notify}/>}
      {page === 'Maintenance' && <><MaintenanceAdvice/><LiveMaintenance notify={notify} ownerId={profile?.id} properties={portfolio}/></>}
      {page === 'More' && <More notify={notify} setPage={navigate} isAdmin={membership?.isAdmin}/>}
      {page === 'Applications' && <ApplicationModule properties={portfolio} notify={notify}/>}
      {page === 'Inspections' && <InspectionModule properties={portfolio} ownerId={profile?.id} notify={notify}/>}
      {page === 'Documents' && <DocumentsModule properties={portfolio} notify={notify}/>}
      {page === 'Renewals' && <RenewalsModule properties={portfolio} notify={notify} ownerId={profile?.id} profile={profile}/>}
      {page === 'Invoices' && <Invoices ownerId={profile?.id} profile={profile} properties={portfolio} notify={notify}/>}
      {page === 'Finances' && <PropertyFinance ownerId={profile?.id} profile={profile} properties={portfolio} notify={notify}/>}
      {page === 'Admin' && (membership?.isAdmin?<AdminGate onClose={()=>navigate('Settings')}/>:<p>Administrator access required.</p>)}
      {page === 'Membership' && membership && <MembershipPanel membership={membership} refresh={refreshMembership}/>}
      {page === 'Learn' && <LearnModule properties={portfolio} notify={notify}/>}
      {page === 'Legal' && <LegalPage/>}
      {page === 'Professional help' && <ProfessionalHelp profile={profile} user={user} properties={portfolio}/>}
      {page === 'Settings' && <><SettingsModule user={user} profile={profile} onProfileUpdated={()=>window.location.reload()}/><DeletionRequest/><section className="settings-admin-group"><details><summary>My membership</summary><MembershipPanel membership={membership} refresh={refreshMembership}/></details>{membership?.isAdmin&&<details><summary>Administration · password protected</summary><p>Members, subscriptions, payments, email setup and agent enquiries.</p><button className="secondary" onClick={()=>navigate('Admin')}><ShieldCheck size={18}/>Open administration</button></details>}</section></>}
    </main>

    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.map(([name, Icon]) => <button className={page===name?'active':''} onClick={()=>navigate(name)} aria-current={page===name?'page':undefined} key={name}><Icon size={20}/><span>{name==='Today'?'Overview':name==='Finances'?'Money':name}</span></button>)}</nav>
    <button className="fab" onClick={()=>setQuick(true)} aria-label="Quick add"><Plus size={25}/></button>

    {quick && <div className="modal-backdrop" onClick={()=>setQuick(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="Quick actions" onClick={e=>e.stopPropagation()}><div className="sheet-head"><div><small>QUICK ADD</small><h2>What would you like to do?</h2></div><button aria-label="Close quick actions" onClick={()=>setQuick(false)}><X/></button></div><div className="quick-grid">{[['Property',Building2],['Application form',FilePenLine],['Inspection',ClipboardCheck],['Maintenance',Hammer],['Payment',Receipt],['Document',FilePenLine]].map(([n,I])=><button key={n} onClick={()=>{setQuick(false);if(n==='Property')setAddingProperty(true);else navigate({'Application form':'Applications',Inspection:'Inspections',Maintenance:'Maintenance',Payment:'Finances',Document:'Documents'}[n])}}><I/><span>{n}</span></button>)}</div></div></div>}
    {addingProperty&&<PropertyEditor propertyCount={portfolio.length} ownerId={profile?.id} onClose={()=>setAddingProperty(false)} onSaved={saved=>{setAddingProperty(false);setRefreshKey(x=>x+1);navigate('Properties');notify('Property added',{propertyId:saved.id})}}/>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function Today({setPage,setQuick,properties,tasks,openProperty,addProperty,loading,dataError,attentionError,notify}) {
  const rent=properties.reduce((sum,p)=>sum+Number(p.activeLease?.monthly_rent||p.monthly_rent||0),0)
  const occupied=properties.filter(p=>p.status==='Occupied').length
  const incomplete=properties.find(p=>!p.activeLease)
  return <div className="page-grid">
    <section className="content-col">
      <div className="hero"><div><span className="eyebrow">A LITTLE LESS ADMIN. A LOT MORE CLARITY.</span><h2>Your rentals, under control.</h2><p>Keep track of your properties, people and next steps.</p></div><button onClick={()=>setQuick(true)}><Plus size={18}/> Quick actions</button></div>
      <div className="overview-stats" aria-label="Portfolio summary">
        <button onClick={()=>setPage('Properties')}><Building2 size={20}/><span><small>Properties</small><strong>{loading||dataError?'—':properties.length}</strong></span><ChevronRight size={16}/></button>
        <button onClick={()=>setPage('Properties')}><KeyRound size={20}/><span><small>Occupied</small><strong>{loading||dataError?'—':occupied}<em> / {properties.length}</em></strong></span><ChevronRight size={16}/></button>
        <button onClick={()=>setPage('Finances')}><WalletCards size={20}/><span><small>Monthly rent on file</small><strong>{loading||dataError?'—':`R${rent.toLocaleString('en-ZA')}`}</strong></span><ChevronRight size={16}/></button>
      </div>
      <div className="section-title" id="attention"><div><span className="eyebrow">YOUR NEXT ACTIONS</span><h2>Needs attention</h2></div><span className="count">{tasks.length}</span></div>
      <div className="task-list">{tasks.length?tasks.map(({icon:Icon,title,detail,level,page,propertyId},i)=><button className="task" key={`${title}-${i}`} onClick={()=>propertyId?(localStorage.setItem('myrental_renewal_property',propertyId),setPage('Renewals')):setPage(page)}><span className={`task-icon ${level}`}><Icon size={19}/></span><div><b>{title}</b><small>{detail}</small></div><span className={`tag ${level}`}>{level}</span><ChevronRight size={18}/></button>):<div className="task quiet-state"><span className="task-icon normal"><ClipboardCheck size={19}/></span><div><b>{loading?'Checking your portfolio…':dataError||attentionError?'Actions unavailable':'No upcoming actions to show'}</b><small>{dataError||attentionError?'Refresh the page to check your latest records.':'Saved reminders, deadlines and urgent repairs appear here.'}</small></div></div>}</div>
      <div className="section-title spaced"><div><span className="eyebrow">A HOME FOR EVERY DETAIL</span><h2>Your properties</h2></div><button className="text-btn" onClick={()=>setPage('Properties')}>View all <ChevronRight size={16}/></button></div>
      {properties.length?<div className="property-row">{properties.map(p=><button className="property-card property-preview" key={p.id} onClick={()=>openProperty(p)}><div className={`property-image ${p.tone}`}><Building2 size={32}/><span>{p.status}</span></div><div className="property-body"><small>{(p.area||'South Africa').toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div><b>{p.rent}</b>{p.rent!=='Not set'&&<span>per month</span>}<ChevronRight size={18}/></div></div></button>)}</div>:!loading&&!dataError&&<div className="empty-card"><Building2/><h3>Your portfolio starts here</h3><p>Add a property to organise its tenant, lease and rental records.</p><button onClick={addProperty}><Plus size={17}/> Add your first property</button></div>}
    </section>
    <aside className="right-col">{incomplete&&<div className="guide-card"><span className="round-icon"><KeyRound/></span><span className="eyebrow">ONE STEP AT A TIME</span><h3>{incomplete?'Finish your rental setup':'Find your next step'}</h3><p>{incomplete?`Add tenant details and lease terms for ${incomplete.name}.`:'Follow the rental journey from finding a tenant to managing the lease.'}</p><button onClick={()=>incomplete?openProperty(incomplete):setPage('Rent')}>{incomplete?'Complete lease details':'Explore rental journey'} <ChevronRight size={17}/></button></div>}<div className="shortcut-card"><span className="eyebrow">EVERYDAY TOOLS</span>{[[UserRound,'Applications','Review tenant applications'],[Hammer,'Maintenance','Track issues and repairs'],[ClipboardCheck,'Inspections','Record property condition'],[FilePenLine,'Documents','Prepare and organise records']].map(([Icon,page,text])=><button key={page} onClick={()=>setPage(page)}><Icon size={19}/><span><b>{page}</b><small>{text}</small></span><ChevronRight size={16}/></button>)}</div></aside>
    <section className="overview-journey"><span className="eyebrow">YOUR COMPLETE RENTAL GUIDE</span><h2>One step at a time</h2><p>Learn what to do from preparing a property to move-out, with forms and practical next steps.</p><button className="primary" onClick={()=>setPage('Learn')}>View rental journey <ChevronRight size={17}/></button><details><summary>Open the step-by-step learning guide</summary><LearnModule properties={properties} notify={notify}/></details></section>
  </div>
}

function Properties({notify,properties,ownerId,onRefresh,onTenantNotice}) {
  const [editing,setEditing]=useState(null)
  const [adding,setAdding]=useState(false)
  const [search,setSearch]=useState('')
  const visible=properties.filter(p=>[p.name,p.area,p.tenant,p.address].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())))
  useEffect(()=>{const savedId=localStorage.getItem('myrental_open_property');if(savedId&&!editing&&properties.length){const match=properties.find(p=>p.id===savedId);if(match)setEditing(match)}},[properties,editing])
  const openEditor=(property)=>{localStorage.setItem('myrental_open_property',property.id);setEditing(property)}
  const closeEditor=()=>{localStorage.removeItem('myrental_open_property');setEditing(null)}
  return <section><div className="page-intro"><div><span className="eyebrow">{properties.length} {properties.length===1?'PROPERTY':'PROPERTIES'}</span><h2>Your rental portfolio</h2><p>Each property keeps its tenants, documents, money and history together.</p></div><button className="primary" onClick={()=>setAdding(true)}><Plus size={18}/> Add property</button></div><label className="portfolio-search"><Search size={19}/><input type="search" placeholder="Search property, area or tenant" aria-label="Search properties" value={search} onChange={e=>setSearch(e.target.value)}/></label>{visible.length===0&&<div className="empty-card"><Building2/><h3>{search?'No matching properties':'Add your first property'}</h3><p>{search?'Try a different address, area or tenant name.':'Keep all your rental details together in one place.'}</p>{!search&&<button onClick={()=>setAdding(true)}>Add property</button>}</div>}<div className="property-grid">{visible.map(p=><article className="wide-card property-open" key={p.id} onClick={()=>openEditor(p)} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openEditor(p)}}} tabIndex="0" aria-label={`Open rental file for ${p.name}`}><div className={`property-image ${p.tone}`}><Building2 size={42}/></div><div className="wide-main"><span className="status">{p.status}</span><small>{(p.area||'South Africa').toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div className="facts"><span><small>MONTHLY RENT</small><b>{p.rent}</b></span><span><small>LEASE ENDS</small><b>{p.lease}</b></span></div></div>{p.activeLease&&<button className="secondary" onClick={e=>{e.stopPropagation();onTenantNotice(p.id)}}>Tenant gave notice</button>}<button className="arrow" aria-label={`Open ${p.name}`}><ChevronRight/></button></article>)}</div>{adding&&<PropertyEditor propertyCount={properties.length} ownerId={ownerId} onClose={()=>setAdding(false)} onSaved={saved=>{setAdding(false);onRefresh();notify('Property added',{propertyId:saved.id})}}/>}{editing&&<LeaseEditor property={editing} ownerId={ownerId} onClose={closeEditor} onSaved={()=>{localStorage.removeItem('myrental_open_property');localStorage.removeItem(`myrental_lease_draft_${editing.id}`);setEditing(null);onRefresh();notify('Lease details saved')}}/>}</section>
}

function PropertyEditor({ownerId,onClose,onSaved,propertyCount=0}) {
  const draftKey='myrental_new_property_draft'
  const blank={name:'',address:'',suburb:'',province:'Western Cape',status:'vacant',monthly_rent:'',deposit_amount:'',property_type:'house',bedrooms:'',bathrooms:'',notes:''}
  const [form,setForm]=useState(()=>{try{return {...blank,...JSON.parse(localStorage.getItem(draftKey)||'{}')}}catch{return blank}})
  const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const set=(key,value)=>setForm({...form,[key]:value})
  const suggestedDeposit=Number(form.monthly_rent||0)*1.5
  useEffect(()=>{localStorage.setItem(draftKey,JSON.stringify(form))},[form])
  const save=async(e)=>{e.preventDefault();setBusy(true);setError('');const payload={owner_id:ownerId,name:form.name,address:form.address,suburb:form.suburb,province:form.province,status:form.status,monthly_rent:form.monthly_rent?Number(form.monthly_rent):null,deposit_amount:form.deposit_amount?Number(form.deposit_amount):null,property_type:form.property_type,bedrooms:form.bedrooms?Number(form.bedrooms):null,bathrooms:form.bathrooms?Number(form.bathrooms):null,notes:form.notes||null};const {data:savedProperty,error:saveError}=await supabase.from('properties').insert(payload).select('id').single();if(saveError){setError(saveError.message);setBusy(false);return}localStorage.removeItem(draftKey);onSaved(savedProperty)}
  return <div className="editor-backdrop" onClick={onClose}><form className="lease-editor" onSubmit={save} onClick={e=>e.stopPropagation()}><div className="editor-head"><div><span className="eyebrow">NEW RENTAL PROPERTY</span><h2>Add a property</h2><p>Draft saved automatically</p></div><button type="button" aria-label="Close editor" onClick={onClose}><X/></button></div><section className="editor-section"><h3>Property details</h3><details><summary>Tips for adding your property</summary><p>Use the full address and correct status. Confirm the property is safe, habitable and ready to let. After saving, add the current tenant and lease if occupied, or create an application form if vacant.</p></details><div className="form-grid"><label>Property name<input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. 14 Protea Lane"/></label><label>Property type<select value={form.property_type} onChange={e=>set('property_type',e.target.value)}><option value="house">House</option><option value="apartment">Apartment</option><option value="townhouse">Townhouse</option><option value="cottage">Cottage</option><option value="other">Other</option></select></label><label>Street address<input required value={form.address} onChange={e=>set('address',e.target.value)}/></label><label>Suburb / town<input required value={form.suburb} onChange={e=>set('suburb',e.target.value)}/></label><label>Province<select value={form.province} onChange={e=>set('province',e.target.value)}>{['Western Cape','Eastern Cape','Northern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West'].map(x=><option key={x}>{x}</option>)}</select></label><label>Current status<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="new">Newly purchased</option></select></label><label>Bedrooms<input min="0" step="1" type="number" value={form.bedrooms} onChange={e=>set('bedrooms',e.target.value)}/></label><label>Bathrooms<input min="0" step="0.5" type="number" value={form.bathrooms} onChange={e=>set('bathrooms',e.target.value)}/></label></div><label>Property notes<textarea rows="3" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Complex name, unit details, parking or other notes…"/></label></section><section className="editor-section"><h3>Rental information</h3><p className="editor-help">With this property you will have {propertyCount+1} homes. Standard membership: R{planForHomes(propertyCount+1).amount}/month. Paid members must confirm a higher plan in Settings → My membership before crossing a tier limit.</p><div className="form-grid"><label>Current or expected rent (R)<input min="0" step="0.01" type="number" value={form.monthly_rent} onChange={e=>set('monthly_rent',e.target.value)}/></label><label>Deposit amount (R)<input min="0" step="0.01" type="number" value={form.deposit_amount} onChange={e=>set('deposit_amount',e.target.value)}/></label></div>{suggestedDeposit>0&&<DepositGuidance rent={Number(form.monthly_rent)} suggested={suggestedDeposit} onUse={()=>set('deposit_amount',suggestedDeposit)}/>}<p className="editor-help">If the property is occupied, open it after saving to add the current tenant and complete lease terms.</p></section>{error&&<div className="auth-message">{error}</div>}<div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={busy}>{busy?'Saving…':'Add property'}</button></div></form></div>
}

function DepositGuidance({rent,suggested,onUse}) { return <div className="deposit-guidance"><div><span>RECOMMENDED STARTING POINT</span><h4>Consider a 1.5-month deposit: R{suggested.toLocaleString('en-ZA')}</h4><p>A one-month deposit can be insufficient if unpaid rent, utilities, lost keys and tenant-caused damage overlap. A 1.5-month deposit creates a larger buffer. This is practical guidance—not a legal minimum or a substitute for assessing affordability, the property and the applicant.</p></div><button type="button" onClick={onUse}>Use R{suggested.toLocaleString('en-ZA')}</button><small>Any agreed deposit must be recorded in the lease, handled lawfully, invested as required, and reconciled with interest and supporting receipts. Complete proper ingoing and outgoing inspections.</small></div> }

function LeaseEditor({property,ownerId,onClose,onSaved}) {
  const current=property.activeLease||{}
  const draftKey=`myrental_lease_draft_${property.id}`
  const initialForm={tenant_name:current.tenant_name||'',tenant_email:current.tenant_email||'',tenant_phone:current.tenant_phone||'',start_date:current.start_date||'',end_date:current.end_date||'',monthly_rent:current.monthly_rent??property.monthly_rent??'',deposit_amount:current.deposit_amount??property.deposit_amount??'',payment_day:current.payment_day||1,escalation_percent:current.escalation_percent||'',lease_type:current.lease_type||'fixed',cpa_status:current.cpa_status||'review_required',electricity_payer:current.electricity_payer||'tenant',water_payer:current.water_payer||'tenant',pets_allowed:Boolean(current.pets_allowed),smoking_allowed:Boolean(current.smoking_allowed),subletting_allowed:Boolean(current.subletting_allowed),special_conditions:current.special_conditions||''}
  const [form,setForm]=useState(()=>{try{return {...initialForm,...JSON.parse(localStorage.getItem(draftKey)||'{}')}}catch{return initialForm}})
  const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const set=(key,value)=>setForm({...form,[key]:value})
  const suggestedLeaseDeposit=Number(form.monthly_rent||0)*1.5
  useEffect(()=>{localStorage.setItem(draftKey,JSON.stringify(form))},[draftKey,form])
  const save=async(e)=>{e.preventDefault();if(form.end_date&&form.end_date<form.start_date){setError('The lease end date must be on or after the start date.');return}setBusy(true);setError('');const payload={...form,property_id:property.id,owner_id:ownerId,status:'active',monthly_rent:form.monthly_rent?Number(form.monthly_rent):null,deposit_amount:form.deposit_amount?Number(form.deposit_amount):null,escalation_percent:form.escalation_percent?Number(form.escalation_percent):null,payment_day:Number(form.payment_day),updated_at:new Date().toISOString()};const query=current.id?supabase.from('leases').update(payload).eq('id',current.id):supabase.from('leases').insert(payload);const {error:saveError}=await query;if(saveError){setError(saveError.message);setBusy(false);return}await supabase.from('properties').update({status:'occupied',monthly_rent:payload.monthly_rent,deposit_amount:payload.deposit_amount,updated_at:new Date().toISOString()}).eq('id',property.id);onSaved()}
  return <div className="editor-backdrop" onClick={onClose}><form className="lease-editor" onSubmit={save} onClick={e=>e.stopPropagation()}><div className="editor-head"><div><span className="eyebrow">PROPERTY RENTAL FILE</span><h2>{property.name}</h2><p>{property.address}, {property.suburb} · Draft saved automatically</p></div><button type="button" aria-label="Close editor" onClick={onClose}><X/></button></div><section className="editor-section"><h3>Tenant details</h3><details><summary>Tips before adding a tenant and lease</summary><p>Verify the applicant’s details and consent, agree terms in writing, and use the signed lease’s actual dates and amounts. Then arrange the ingoing inspection, retain signed records and set up invoices.</p></details><div className="form-grid"><label>Tenant’s full name<input required value={form.tenant_name} onChange={e=>set('tenant_name',e.target.value)}/></label><label>Email address<input type="email" value={form.tenant_email} onChange={e=>set('tenant_email',e.target.value)}/></label><label>Mobile number<input type="tel" value={form.tenant_phone} onChange={e=>set('tenant_phone',e.target.value)}/></label></div></section><section className="editor-section"><h3>Lease term and money</h3><div className="form-grid"><label>Start date<input required type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)}/></label><label>End date<input required min={form.start_date||undefined} type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)}/></label><label>Monthly rent (R)<input required min="0" step="0.01" type="number" value={form.monthly_rent} onChange={e=>set('monthly_rent',e.target.value)}/></label><label>Deposit held (R)<input min="0" step="0.01" type="number" value={form.deposit_amount} onChange={e=>set('deposit_amount',e.target.value)}/></label><label>Rent payment day<input min="1" max="31" type="number" value={form.payment_day} onChange={e=>set('payment_day',e.target.value)}/></label><label>Annual escalation (%)<input min="0" max="100" step="0.1" type="number" value={form.escalation_percent} onChange={e=>set('escalation_percent',e.target.value)}/></label><label>Lease type<select value={form.lease_type} onChange={e=>set('lease_type',e.target.value)}><option value="fixed">Fixed term</option><option value="month_to_month">Month to month</option></select></label><label>CPA assessment<select value={form.cpa_status} onChange={e=>set('cpa_status',e.target.value)}><option value="review_required">Needs guided assessment</option><option value="likely_applies">CPA likely applies</option><option value="likely_not_applies">CPA likely does not apply</option><option value="attorney_confirmed">Confirmed by attorney</option></select></label></div>{suggestedLeaseDeposit>0&&<DepositGuidance rent={Number(form.monthly_rent)} suggested={suggestedLeaseDeposit} onUse={()=>set('deposit_amount',suggestedLeaseDeposit)}/>}</section><section className="editor-section"><h3>Charges and permissions</h3><div className="form-grid"><label>Electricity paid by<select value={form.electricity_payer} onChange={e=>set('electricity_payer',e.target.value)}><option value="tenant">Tenant</option><option value="landlord">Landlord</option><option value="included">Included in rent</option></select></label><label>Water paid by<select value={form.water_payer} onChange={e=>set('water_payer',e.target.value)}><option value="tenant">Tenant</option><option value="landlord">Landlord</option><option value="included">Included in rent</option></select></label></div><div className="toggle-row">{[['pets_allowed','Pets allowed'],['smoking_allowed','Smoking allowed'],['subletting_allowed','Subletting allowed']].map(([key,label])=><label key={key}><input type="checkbox" checked={form[key]} onChange={e=>set(key,e.target.checked)}/><span>{label}</span></label>)}</div><label>Special conditions<textarea rows="4" value={form.special_conditions} onChange={e=>set('special_conditions',e.target.value)} placeholder="Record agreed special conditions or notes…"/></label></section>{error&&<div className="auth-message">{error}</div>}<div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save lease terms'}</button></div></form></div>
}

function Rent({setPage}) { return <section><div className="page-intro"><div><span className="eyebrow">GUIDED RENTAL JOURNEY</span><h2>Rent out with confidence</h2><p>Follow the correct steps from preparing your property to signing the lease.</p></div></div><div className="flow-grid">{flows.map(({icon:Icon,title,text},i)=><button className="flow-card" key={title} onClick={()=>setPage(['Learn','Applications','Properties','Inspections','Maintenance','Renewals'][i])}><span className="step">{String(i+1).padStart(2,'0')}</span><Icon/><h3>{title}</h3><p>{text}</p><span className="open">{['View preparation guide','Open applications','Open property leases','Open inspections','Open maintenance','Open renewals'][i]} <ChevronRight size={16}/></span></button>)}</div></section> }

function Maintenance({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">MAINTENANCE</span><h2>Issues and repairs</h2><p>Keep quotes, responsibility, follow-ups and proof in one timeline.</p></div><button className="primary" onClick={()=>notify('Maintenance form will open here')}><Plus size={18}/> Log issue</button></div><div className="empty-card"><ClipboardCheck/><h3>No open maintenance issues</h3><p>New tenant reports and issues you log will appear here.</p><button onClick={()=>notify('Secure link copied')}>Create tenant reporting link</button></div></section> }

function More({notify,setPage,isAdmin}) { const items=[[Receipt,'Invoices','Monthly invoices, rent received and arrears guidance'],[UserRound,'Applications','Create a property-specific form to email'],[ClipboardCheck,'Inspections','Ingoing, interim and outgoing'],[FilePenLine,'Documents','Leases, addendums and notices'],[CalendarDays,'Renewals','Renewals and term changes'],[WalletCards,'Finances','Income, expenses, bills and annual reports'],[BookOpen,'Learn','Plain-language landlord guidance'],[Building2,'Professional help','Self-manage or appoint an agent'],[ShieldCheck,'Legal','Terms, disclaimer and privacy'],[ShieldCheck,'Settings','Account, password and security']]; return <section><div className="page-intro"><div><span className="eyebrow">MYRENTAL SA</span><h2>Tools and guidance</h2><p>Everything else you need to manage your rental properly.</p></div></div><div className="more-list">{items.map(([I,title,text])=><button key={title} onClick={()=>setPage(title)}><span><I/></span><div><b>{title}</b><small>{text}</small></div><ChevronRight/></button>)}</div><div className="disclaimer"><AlertTriangle/><div><b>Legal guidance, not legal advice</b><p>MyRental SA provides guided workflows and educational information. Serious breaches, evictions and unusual circumstances should be reviewed by a qualified South African property attorney.</p></div></div></section> }

export default App
