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
import {
  AlertTriangle, Bell, BookOpen, Building2, CalendarDays, ChevronRight,
  ClipboardCheck, FilePenLine, Hammer, Home, KeyRound, LayoutGrid,
  Link2, Menu, Plus, Receipt, Search, ShieldCheck, UserRound, WalletCards, X
} from 'lucide-react'

const tasks = []

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

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => {
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
      setProfile(profileResult.data)
      setHasProperty(Boolean(propertyResult.data?.length))
      setLegalAccepted(Boolean(legalResult.data))
      setLoading(false)
    })
  }, [session])

  if (!supabaseConfigured) return <Dashboard demo />
  if (loading || session === undefined) return <LoadingScreen />
  if (!session) return <AuthScreen />
  if (!legalAccepted) return <LegalAcceptance user={session.user} onAccepted={()=>setLegalAccepted(true)}/>
  if (!profile?.onboarding_complete || !hasProperty) return <Onboarding user={session.user} profile={profile} onComplete={(nextProfile)=>{setProfile(nextProfile);setHasProperty(true)}} />
  return <Dashboard user={session.user} profile={profile} onSignOut={()=>supabase.auth.signOut()} />
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
  return <div className="auth-shell"><section className="auth-brand-panel"><Brand/><div><span className="eyebrow">PRIVATE LANDLORDS · SOUTH AFRICA</span><h1>Rent out with confidence.</h1><p>Every property, deadline and document—guided from advertising to deposit reconciliation.</p></div><small>Guidance and organisation for responsible landlords.</small></section><section className="auth-form-panel"><div className="auth-card"><span className="eyebrow">WELCOME TO MYRENTAL SA</span><h2>{mode==='login'?'Sign in to your account':'Create your landlord account'}</h2><p>{mode==='login'?'Continue managing your rentals.':'Start with your first property in a few guided steps.'}</p><form onSubmit={submit}>{mode==='signup'&&<label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></label>}<label>Email address<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>{mode==='login'&&<button type="button" className="forgot-link" onClick={resetPassword}>Forgot password?</button>}{message&&<div className="auth-message">{message}</div>}<button className="auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button></form><button className="auth-switch" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'New to MyRental SA? Create an account':'Already registered? Sign in'}</button></div></section></div>
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

function Dashboard({ user, profile, onSignOut, demo=false }) {
  const [page, setPage] = useState(()=>localStorage.getItem('myrental_last_page')||'Today')
  const [quick, setQuick] = useState(false)
  const [toast, setToast] = useState('')
  const [portfolio, setPortfolio] = useState([])
  const [attention, setAttention] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const today = useMemo(() => new Intl.DateTimeFormat('en-ZA', { weekday:'long', day:'numeric', month:'long' }).format(new Date()), [])
  const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 2600) }

  useEffect(()=>{localStorage.setItem('myrental_last_page',page)},[page])

  useEffect(() => {
    if (!profile?.id || !supabase) return
    supabase.from('properties').select('*, leases(*)').eq('owner_id', profile.id).order('created_at', { ascending:false }).then(({data}) => {
      setPortfolio((data||[]).map((p,index)=>{
        const activeLease=(p.leases||[]).find(l=>l.status==='active')||(p.leases||[])[0]
        return ({
        ...p,
        activeLease,
        area:p.suburb,
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
      const now=new Date();now.setHours(0,0,0,0);const soon=new Date(now);soon.setDate(soon.getDate()+30)
      const recordItems=(records.data||[]).filter(r=>{const d=new Date(`${r.due_date}T12:00:00`);return d<=soon&&!['Completed','Declined','Refunded','Reconciled'].includes(r.status)}).map(r=>{const d=new Date(`${r.due_date}T12:00:00`);const overdue=d<now;return {icon:CalendarDays,title:r.title,detail:`${r.properties?.name||'Rental record'} · ${overdue?'Overdue':`Due ${new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short'}).format(d)}`}`,level:overdue?'urgent':'high',page:r.record_type==='application'?'Applications':r.record_type==='inspection'?'Inspections':r.record_type==='finance'?'Finances':r.record_type==='renewal'?'Renewals':'Documents'}})
      const maintenanceItems=(maintenance.data||[]).filter(m=>m.urgent).map(m=>({icon:Hammer,title:m.issue,detail:`${m.properties?.name||'Property'} · ${m.status}`,level:'urgent',page:'Maintenance'}))
      setAttention([...maintenanceItems,...recordItems].slice(0,8))
    })
  },[profile?.id,refreshKey,page])

  const nav = [
    ['Today', Home], ['Properties', Building2], ['Rent', KeyRound], ['Maintenance', Hammer], ['More', Menu]
  ]

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <nav>{nav.map(([name, Icon]) => <button className={page===name?'active':''} onClick={()=>setPage(name)} key={name}><Icon size={19}/><span>{name}</span></button>)}</nav>
      <div className="legal-mini"><ShieldCheck size={18}/><p><b>Guidance you can trust</b><br/>Important legal matters are clearly flagged for professional review.</p></div>
      <button className="profile" onClick={onSignOut}><span>{(profile?.full_name||'Melissa').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><div><b>{profile?.full_name?.split(' ')[0]||'Melissa'}</b><small>{demo?'Demo landlord':'Sign out'}</small></div></button>
    </aside>

    <main>
      <header><div className="mobile-brand"><Brand/></div><div><p>{today}</p><h1>{page === 'Today' ? `Good morning, ${profile?.full_name?.split(' ')[0]||'Melissa'}` : page}</h1></div><button className="icon-btn" aria-label="Notifications"><Bell size={21}/><i/></button></header>
      {page === 'Today' && <Today setPage={setPage} setQuick={setQuick} properties={portfolio} tasks={attention}/>} 
      {page === 'Properties' && <Properties notify={notify} properties={portfolio} ownerId={profile?.id} onRefresh={()=>setRefreshKey(x=>x+1)}/>} 
      {page === 'Rent' && <Rent notify={notify}/>} 
      {page === 'Maintenance' && <LiveMaintenance notify={notify} ownerId={profile?.id} properties={portfolio}/>} 
      {page === 'More' && <More notify={notify} setPage={setPage}/>} 
      {page === 'Applications' && <ApplicationModule properties={portfolio} notify={notify}/>} 
      {page === 'Inspections' && <InspectionModule properties={portfolio} ownerId={profile?.id} notify={notify}/>} 
      {page === 'Documents' && <DocumentsModule properties={portfolio} notify={notify}/>} 
      {page === 'Renewals' && <RenewalsModule properties={portfolio} notify={notify}/>} 
      {page === 'Finances' && <RentalModule name={page} ownerId={profile?.id} properties={portfolio} notify={notify}/>} 
      {page === 'Learn' && <LearnModule/>}
      {page === 'Legal' && <LegalPage/>}
      {page === 'Professional help' && <ProfessionalHelp/>}
      {page === 'Settings' && <SettingsModule user={user} profile={profile} onProfileUpdated={()=>window.location.reload()}/>} 
    </main>

    <nav className="bottom-nav">{nav.map(([name, Icon]) => <button className={page===name?'active':''} onClick={()=>setPage(name)} key={name}><Icon size={20}/><span>{name}</span></button>)}</nav>
    <button className="fab" onClick={()=>setQuick(true)} aria-label="Quick add"><Plus size={25}/></button>

    {quick && <div className="modal-backdrop" onClick={()=>setQuick(false)}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="sheet-head"><div><small>QUICK ADD</small><h2>What would you like to do?</h2></div><button onClick={()=>setQuick(false)}><X/></button></div><div className="quick-grid">{[['Property',Building2],['Application form',FilePenLine],['Inspection',ClipboardCheck],['Maintenance',Hammer],['Payment',Receipt],['Reminder',CalendarDays]].map(([n,I])=><button key={n} onClick={()=>{setQuick(false);if(n==='Application form')setPage('Applications');else notify(`${n} form will open here`)}}><I/><span>{n}</span></button>)}</div></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Today({setPage,setQuick,properties,tasks}) {
  return <div className="page-grid">
    <section className="content-col">
      <div className="hero"><div><span className="eyebrow">YOUR RENTAL OVERVIEW</span><h2>Everything in one place.</h2><p>{tasks.length?`${tasks.length} items need your attention.`:'You have no outstanding actions today.'}</p></div><button onClick={()=>setQuick(true)}><Plus size={18}/> Quick add</button></div>
      <div className="section-title"><div><span className="eyebrow">TODAY</span><h2>What needs your attention</h2></div><span className="count">{tasks.length}</span></div>
      <div className="task-list">{tasks.length?tasks.map(({icon:Icon,title,detail,level,page},i)=><button className="task" key={`${title}-${i}`} onClick={()=>setPage(page)}><span className={`task-icon ${level}`}><Icon size={19}/></span><div><b>{title}</b><small>{detail}</small></div><span className={`tag ${level}`}>{level}</span><ChevronRight size={18}/></button>):<div className="task"><span className="task-icon normal"><ClipboardCheck size={19}/></span><div><b>You’re up to date</b><small>Reminders and deadlines will appear here.</small></div></div>}</div>
      <div className="section-title spaced"><div><span className="eyebrow">YOUR PROPERTIES</span><h2>Portfolio</h2></div><button className="text-btn" onClick={()=>setPage('Properties')}>View all <ChevronRight size={16}/></button></div>
      <div className="property-row">{properties.map(p=><article className="property-card" key={p.id}><div className={`property-image ${p.tone}`}><Building2 size={32}/><span>{p.status}</span></div><div className="property-body"><small>{p.area.toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div><b>{p.rent}</b>{p.rent!=='Not set'&&<span>per month</span>}</div></div></article>)}</div>
    </section>
    <aside className="right-col"><div className="guide-card"><span className="round-icon"><BookOpen/></span><span className="eyebrow">YOUR NEXT STEP</span><h3>Complete your property setup</h3><p>Add rental terms, tenant details and important dates to receive useful reminders.</p><button onClick={()=>setPage('Properties')}>Open properties <ChevronRight size={17}/></button></div><div className="tip-card"><ShieldCheck/><div><b>Good to know</b><p>Store proof of every inspection, notice and payment against the correct property.</p></div></div></aside>
  </div>
}

function Properties({notify,properties,ownerId,onRefresh}) {
  const [editing,setEditing]=useState(null)
  const [adding,setAdding]=useState(false)
  useEffect(()=>{const savedId=localStorage.getItem('myrental_open_property');if(savedId&&!editing&&properties.length){const match=properties.find(p=>p.id===savedId);if(match)setEditing(match)}},[properties,editing])
  const openEditor=(property)=>{localStorage.setItem('myrental_open_property',property.id);setEditing(property)}
  const closeEditor=()=>{localStorage.removeItem('myrental_open_property');setEditing(null)}
  return <section><div className="page-intro"><div><span className="eyebrow">{properties.length} {properties.length===1?'PROPERTY':'PROPERTIES'}</span><h2>Your rental portfolio</h2><p>Each property keeps its tenants, documents, money and history together.</p></div><button className="primary" onClick={()=>setAdding(true)}><Plus size={18}/> Add property</button></div><div className="property-grid">{properties.map(p=><article className="wide-card property-open" key={p.id} onClick={()=>openEditor(p)}><div className={`property-image ${p.tone}`}><Building2 size={42}/></div><div className="wide-main"><span className="status">{p.status}</span><small>{p.area.toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div className="facts"><span><small>MONTHLY RENT</small><b>{p.rent}</b></span><span><small>LEASE ENDS</small><b>{p.lease}</b></span></div></div><button className="arrow" aria-label={`Open ${p.name}`}><ChevronRight/></button></article>)}</div>{adding&&<PropertyEditor ownerId={ownerId} onClose={()=>setAdding(false)} onSaved={()=>{setAdding(false);onRefresh();notify('Property added')}}/>}{editing&&<LeaseEditor property={editing} ownerId={ownerId} onClose={closeEditor} onSaved={()=>{localStorage.removeItem('myrental_open_property');localStorage.removeItem(`myrental_lease_draft_${editing.id}`);setEditing(null);onRefresh();notify('Lease details saved')}}/>}</section>
}

function PropertyEditor({ownerId,onClose,onSaved}) {
  const draftKey='myrental_new_property_draft'
  const blank={name:'',address:'',suburb:'',province:'Western Cape',status:'vacant',monthly_rent:'',deposit_amount:'',property_type:'house',bedrooms:'',bathrooms:'',notes:''}
  const [form,setForm]=useState(()=>{try{return {...blank,...JSON.parse(localStorage.getItem(draftKey)||'{}')}}catch{return blank}})
  const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const set=(key,value)=>setForm({...form,[key]:value})
  const suggestedDeposit=Number(form.monthly_rent||0)*1.5
  useEffect(()=>{localStorage.setItem(draftKey,JSON.stringify(form))},[form])
  const save=async(e)=>{e.preventDefault();setBusy(true);setError('');const payload={owner_id:ownerId,name:form.name,address:form.address,suburb:form.suburb,province:form.province,status:form.status,monthly_rent:form.monthly_rent?Number(form.monthly_rent):null,deposit_amount:form.deposit_amount?Number(form.deposit_amount):null,property_type:form.property_type,bedrooms:form.bedrooms?Number(form.bedrooms):null,bathrooms:form.bathrooms?Number(form.bathrooms):null,notes:form.notes||null};const {error:saveError}=await supabase.from('properties').insert(payload);if(saveError){setError(saveError.message);setBusy(false);return}localStorage.removeItem(draftKey);onSaved()}
  return <div className="editor-backdrop" onClick={onClose}><form className="lease-editor" onSubmit={save} onClick={e=>e.stopPropagation()}><div className="editor-head"><div><span className="eyebrow">NEW RENTAL PROPERTY</span><h2>Add a property</h2><p>Draft saved automatically</p></div><button type="button" onClick={onClose}><X/></button></div><section className="editor-section"><h3>Property details</h3><div className="form-grid"><label>Property name<input required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. 14 Protea Lane"/></label><label>Property type<select value={form.property_type} onChange={e=>set('property_type',e.target.value)}><option value="house">House</option><option value="apartment">Apartment</option><option value="townhouse">Townhouse</option><option value="cottage">Cottage</option><option value="other">Other</option></select></label><label>Street address<input required value={form.address} onChange={e=>set('address',e.target.value)}/></label><label>Suburb / town<input required value={form.suburb} onChange={e=>set('suburb',e.target.value)}/></label><label>Province<select value={form.province} onChange={e=>set('province',e.target.value)}>{['Western Cape','Eastern Cape','Northern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West'].map(x=><option key={x}>{x}</option>)}</select></label><label>Current status<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="new">Newly purchased</option></select></label><label>Bedrooms<input min="0" step="1" type="number" value={form.bedrooms} onChange={e=>set('bedrooms',e.target.value)}/></label><label>Bathrooms<input min="0" step="0.5" type="number" value={form.bathrooms} onChange={e=>set('bathrooms',e.target.value)}/></label></div><label>Property notes<textarea rows="3" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Complex name, unit details, parking or other notes…"/></label></section><section className="editor-section"><h3>Rental information</h3><div className="form-grid"><label>Current or expected rent (R)<input min="0" step="0.01" type="number" value={form.monthly_rent} onChange={e=>set('monthly_rent',e.target.value)}/></label><label>Deposit amount (R)<input min="0" step="0.01" type="number" value={form.deposit_amount} onChange={e=>set('deposit_amount',e.target.value)}/></label></div>{suggestedDeposit>0&&<DepositGuidance rent={Number(form.monthly_rent)} suggested={suggestedDeposit} onUse={()=>set('deposit_amount',suggestedDeposit)}/>}<p className="editor-help">If the property is occupied, open it after saving to add the current tenant and complete lease terms.</p></section>{error&&<div className="auth-message">{error}</div>}<div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={busy}>{busy?'Saving…':'Add property'}</button></div></form></div>
}

function DepositGuidance({rent,suggested,onUse}) { return <div className="deposit-guidance"><div><span>RECOMMENDED STARTING POINT</span><h4>Consider a 1.5-month deposit: R{suggested.toLocaleString('en-ZA')}</h4><p>A one-month deposit can be insufficient if unpaid rent, utilities, lost keys and tenant-caused damage overlap. A 1.5-month deposit creates a larger buffer. This is practical guidance—not a legal minimum or a substitute for assessing affordability, the property and the applicant.</p></div><button type="button" onClick={onUse}>Use R{suggested.toLocaleString('en-ZA')}</button><small>Any agreed deposit must be recorded in the lease, handled lawfully, invested as required, and reconciled with interest and supporting receipts. Complete proper ingoing and outgoing inspections.</small></div> }

function LeaseEditor({property,ownerId,onClose,onSaved}) {
  const current=property.activeLease||{}
  const draftKey=`myrental_lease_draft_${property.id}`
  const initialForm={tenant_name:current.tenant_name||'',tenant_email:current.tenant_email||'',tenant_phone:current.tenant_phone||'',start_date:current.start_date||'',end_date:current.end_date||'',monthly_rent:current.monthly_rent||'',deposit_amount:current.deposit_amount||'',payment_day:current.payment_day||1,escalation_percent:current.escalation_percent||'',lease_type:current.lease_type||'fixed',cpa_status:current.cpa_status||'review_required',electricity_payer:current.electricity_payer||'tenant',water_payer:current.water_payer||'tenant',pets_allowed:Boolean(current.pets_allowed),smoking_allowed:Boolean(current.smoking_allowed),subletting_allowed:Boolean(current.subletting_allowed),special_conditions:current.special_conditions||''}
  const [form,setForm]=useState(()=>{try{return {...initialForm,...JSON.parse(localStorage.getItem(draftKey)||'{}')}}catch{return initialForm}})
  const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const set=(key,value)=>setForm({...form,[key]:value})
  const suggestedLeaseDeposit=Number(form.monthly_rent||0)*1.5
  useEffect(()=>{localStorage.setItem(draftKey,JSON.stringify(form))},[draftKey,form])
  const save=async(e)=>{e.preventDefault();setBusy(true);setError('');const payload={...form,property_id:property.id,owner_id:ownerId,status:'active',monthly_rent:form.monthly_rent?Number(form.monthly_rent):null,deposit_amount:form.deposit_amount?Number(form.deposit_amount):null,escalation_percent:form.escalation_percent?Number(form.escalation_percent):null,payment_day:Number(form.payment_day),updated_at:new Date().toISOString()};const query=current.id?supabase.from('leases').update(payload).eq('id',current.id):supabase.from('leases').insert(payload);const {error:saveError}=await query;if(saveError){setError(saveError.message);setBusy(false);return}await supabase.from('properties').update({status:'occupied',monthly_rent:payload.monthly_rent,deposit_amount:payload.deposit_amount,updated_at:new Date().toISOString()}).eq('id',property.id);onSaved()}
  return <div className="editor-backdrop" onClick={onClose}><form className="lease-editor" onSubmit={save} onClick={e=>e.stopPropagation()}><div className="editor-head"><div><span className="eyebrow">PROPERTY RENTAL FILE</span><h2>{property.name}</h2><p>{property.address}, {property.suburb} · Draft saved automatically</p></div><button type="button" onClick={onClose}><X/></button></div><section className="editor-section"><h3>Tenant details</h3><div className="form-grid"><label>Tenant’s full name<input required value={form.tenant_name} onChange={e=>set('tenant_name',e.target.value)}/></label><label>Email address<input type="email" value={form.tenant_email} onChange={e=>set('tenant_email',e.target.value)}/></label><label>Mobile number<input type="tel" value={form.tenant_phone} onChange={e=>set('tenant_phone',e.target.value)}/></label></div></section><section className="editor-section"><h3>Lease term and money</h3><div className="form-grid"><label>Start date<input required type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)}/></label><label>End date<input required type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)}/></label><label>Monthly rent (R)<input required min="0" step="0.01" type="number" value={form.monthly_rent} onChange={e=>set('monthly_rent',e.target.value)}/></label><label>Deposit held (R)<input min="0" step="0.01" type="number" value={form.deposit_amount} onChange={e=>set('deposit_amount',e.target.value)}/></label><label>Rent payment day<input min="1" max="31" type="number" value={form.payment_day} onChange={e=>set('payment_day',e.target.value)}/></label><label>Annual escalation (%)<input min="0" max="100" step="0.1" type="number" value={form.escalation_percent} onChange={e=>set('escalation_percent',e.target.value)}/></label><label>Lease type<select value={form.lease_type} onChange={e=>set('lease_type',e.target.value)}><option value="fixed">Fixed term</option><option value="month_to_month">Month to month</option></select></label><label>CPA assessment<select value={form.cpa_status} onChange={e=>set('cpa_status',e.target.value)}><option value="review_required">Needs guided assessment</option><option value="likely_applies">CPA likely applies</option><option value="likely_not_applies">CPA likely does not apply</option><option value="attorney_confirmed">Confirmed by attorney</option></select></label></div>{suggestedLeaseDeposit>0&&<DepositGuidance rent={Number(form.monthly_rent)} suggested={suggestedLeaseDeposit} onUse={()=>set('deposit_amount',suggestedLeaseDeposit)}/>}</section><section className="editor-section"><h3>Charges and permissions</h3><div className="form-grid"><label>Electricity paid by<select value={form.electricity_payer} onChange={e=>set('electricity_payer',e.target.value)}><option value="tenant">Tenant</option><option value="landlord">Landlord</option><option value="included">Included in rent</option></select></label><label>Water paid by<select value={form.water_payer} onChange={e=>set('water_payer',e.target.value)}><option value="tenant">Tenant</option><option value="landlord">Landlord</option><option value="included">Included in rent</option></select></label></div><div className="toggle-row">{[['pets_allowed','Pets allowed'],['smoking_allowed','Smoking allowed'],['subletting_allowed','Subletting allowed']].map(([key,label])=><label key={key}><input type="checkbox" checked={form[key]} onChange={e=>set(key,e.target.checked)}/><span>{label}</span></label>)}</div><label>Special conditions<textarea rows="4" value={form.special_conditions} onChange={e=>set('special_conditions',e.target.value)} placeholder="Record agreed special conditions or notes…"/></label></section>{error&&<div className="auth-message">{error}</div>}<div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save lease terms'}</button></div></form></div>
}

function Rent({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">GUIDED RENTAL JOURNEY</span><h2>Rent out with confidence</h2><p>Follow the correct steps from preparing your property to signing the lease.</p></div></div><div className="flow-grid">{flows.map(({icon:Icon,title,text},i)=><button className="flow-card" key={title} onClick={()=>notify(`${title} selected`)}><span className="step">{String(i+1).padStart(2,'0')}</span><Icon/><h3>{title}</h3><p>{text}</p><span className="open">Open guide <ChevronRight size={16}/></span></button>)}</div></section> }

function Maintenance({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">MAINTENANCE</span><h2>Issues and repairs</h2><p>Keep quotes, responsibility, follow-ups and proof in one timeline.</p></div><button className="primary" onClick={()=>notify('Maintenance form will open here')}><Plus size={18}/> Log issue</button></div><div className="empty-card"><ClipboardCheck/><h3>No open maintenance issues</h3><p>New tenant reports and issues you log will appear here.</p><button onClick={()=>notify('Secure link copied')}>Create tenant reporting link</button></div></section> }

function More({notify,setPage}) { const items=[[UserRound,'Applications','Create a property-specific form to email'],[ClipboardCheck,'Inspections','Ingoing, interim and outgoing'],[FilePenLine,'Documents','Leases, addendums and notices'],[CalendarDays,'Renewals','Renewals and term changes'],[WalletCards,'Finances','Rent, deposits and reconciliation'],[BookOpen,'Learn','Plain-language landlord guidance'],[Building2,'Professional help','Self-manage or appoint an agent'],[ShieldCheck,'Legal','Terms, disclaimer and privacy'],[ShieldCheck,'Settings','Account, password and security']]; return <section><div className="page-intro"><div><span className="eyebrow">MYRENTAL SA</span><h2>Tools and guidance</h2><p>Everything else you need to manage your rental properly.</p></div></div><div className="more-list">{items.map(([I,title,text])=><button key={title} onClick={()=>setPage(title)}><span><I/></span><div><b>{title}</b><small>{text}</small></div><ChevronRight/></button>)}</div><div className="disclaimer"><AlertTriangle/><div><b>Legal guidance, not legal advice</b><p>MyRental SA provides guided workflows and educational information. Serious breaches, evictions and unusual circumstances should be reviewed by a qualified South African property attorney.</p></div></div></section> }

export default App
