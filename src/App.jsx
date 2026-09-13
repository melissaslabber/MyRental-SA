import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'
import {
  AlertTriangle, Bell, BookOpen, Building2, CalendarDays, ChevronRight,
  ClipboardCheck, FilePenLine, Hammer, Home, KeyRound, LayoutGrid,
  Link2, Menu, Plus, Receipt, Search, ShieldCheck, UserRound, WalletCards, X
} from 'lucide-react'

const tasks = []

const flows = [
  { icon: Search, title: 'Advertise & find a tenant', text: 'Prepare, advertise and screen fairly.' },
  { icon: UserRound, title: 'Tenant applications', text: 'Send a secure application link.' },
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
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) { setProfile(null); setHasProperty(false); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('properties').select('id').eq('owner_id', session.user.id).limit(1)
    ]).then(([profileResult, propertyResult]) => {
      setProfile(profileResult.data)
      setHasProperty(Boolean(propertyResult.data?.length))
      setLoading(false)
    })
  }, [session])

  if (!supabaseConfigured) return <Dashboard demo />
  if (loading || session === undefined) return <LoadingScreen />
  if (!session) return <AuthScreen />
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
  return <div className="auth-shell"><section className="auth-brand-panel"><Brand/><div><span className="eyebrow">PRIVATE LANDLORDS · SOUTH AFRICA</span><h1>Rent out with confidence.</h1><p>Every property, deadline and document—guided from advertising to deposit reconciliation.</p></div><small>Guidance and organisation for responsible landlords.</small></section><section className="auth-form-panel"><div className="auth-card"><span className="eyebrow">WELCOME TO MYRENTAL SA</span><h2>{mode==='login'?'Sign in to your account':'Create your landlord account'}</h2><p>{mode==='login'?'Continue managing your rentals.':'Start with your first property in a few guided steps.'}</p><form onSubmit={submit}>{mode==='signup'&&<label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your full name"/></label>}<label>Email address<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>{message&&<div className="auth-message">{message}</div>}<button className="auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button></form><button className="auth-switch" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'New to MyRental SA? Create an account':'Already registered? Sign in'}</button></div></section></div>
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

function Dashboard({ profile, onSignOut, demo=false }) {
  const [page, setPage] = useState('Today')
  const [quick, setQuick] = useState(false)
  const [toast, setToast] = useState('')
  const [portfolio, setPortfolio] = useState([])
  const today = useMemo(() => new Intl.DateTimeFormat('en-ZA', { weekday:'long', day:'numeric', month:'long' }).format(new Date()), [])
  const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 2600) }

  useEffect(() => {
    if (!profile?.id || !supabase) return
    supabase.from('properties').select('*').eq('owner_id', profile.id).order('created_at', { ascending:false }).then(({data}) => {
      setPortfolio((data||[]).map((p,index)=>({
        ...p,
        area:p.suburb,
        tenant:p.status==='occupied'?'Tenant details not added':'No current tenant',
        rent:p.monthly_rent?`R${Number(p.monthly_rent).toLocaleString('en-ZA')}`:'Not set',
        status:p.status==='occupied'?'Occupied':p.status==='vacant'?'Vacant':'New property',
        lease:'Not set',
        tone:index%2?'sand':'sage'
      })))
    })
  }, [profile?.id])

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
      {page === 'Today' && <Today setPage={setPage} setQuick={setQuick} properties={portfolio}/>} 
      {page === 'Properties' && <Properties notify={notify} properties={portfolio}/>} 
      {page === 'Rent' && <Rent notify={notify}/>} 
      {page === 'Maintenance' && <Maintenance notify={notify}/>} 
      {page === 'More' && <More notify={notify}/>} 
    </main>

    <nav className="bottom-nav">{nav.map(([name, Icon]) => <button className={page===name?'active':''} onClick={()=>setPage(name)} key={name}><Icon size={20}/><span>{name}</span></button>)}</nav>
    <button className="fab" onClick={()=>setQuick(true)} aria-label="Quick add"><Plus size={25}/></button>

    {quick && <div className="modal-backdrop" onClick={()=>setQuick(false)}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="sheet-head"><div><small>QUICK ADD</small><h2>What would you like to do?</h2></div><button onClick={()=>setQuick(false)}><X/></button></div><div className="quick-grid">{[['Property',Building2],['Application link',Link2],['Inspection',ClipboardCheck],['Maintenance',Hammer],['Payment',Receipt],['Reminder',CalendarDays]].map(([n,I])=><button key={n} onClick={()=>{setQuick(false);notify(`${n} form will open here`)}}><I/><span>{n}</span></button>)}</div></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Today({setPage,setQuick,properties}) {
  return <div className="page-grid">
    <section className="content-col">
      <div className="hero"><div><span className="eyebrow">YOUR RENTAL OVERVIEW</span><h2>Everything in one place.</h2><p>{tasks.length?`${tasks.length} items need your attention.`:'You have no outstanding actions today.'}</p></div><button onClick={()=>setQuick(true)}><Plus size={18}/> Quick add</button></div>
      <div className="section-title"><div><span className="eyebrow">TODAY</span><h2>What needs your attention</h2></div><span className="count">{tasks.length}</span></div>
      <div className="task-list">{tasks.length?tasks.map(({icon:Icon,title,detail,level})=><button className="task" key={title}><span className={`task-icon ${level}`}><Icon size={19}/></span><div><b>{title}</b><small>{detail}</small></div><span className={`tag ${level}`}>{level}</span><ChevronRight size={18}/></button>):<div className="task"><span className="task-icon normal"><ClipboardCheck size={19}/></span><div><b>You’re up to date</b><small>Reminders and deadlines will appear here.</small></div></div>}</div>
      <div className="section-title spaced"><div><span className="eyebrow">YOUR PROPERTIES</span><h2>Portfolio</h2></div><button className="text-btn" onClick={()=>setPage('Properties')}>View all <ChevronRight size={16}/></button></div>
      <div className="property-row">{properties.map(p=><article className="property-card" key={p.id}><div className={`property-image ${p.tone}`}><Building2 size={32}/><span>{p.status}</span></div><div className="property-body"><small>{p.area.toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div><b>{p.rent}</b>{p.rent!=='Not set'&&<span>per month</span>}</div></div></article>)}</div>
    </section>
    <aside className="right-col"><div className="guide-card"><span className="round-icon"><BookOpen/></span><span className="eyebrow">YOUR NEXT STEP</span><h3>Complete your property setup</h3><p>Add rental terms, tenant details and important dates to receive useful reminders.</p><button onClick={()=>setPage('Properties')}>Open properties <ChevronRight size={17}/></button></div><div className="tip-card"><ShieldCheck/><div><b>Good to know</b><p>Store proof of every inspection, notice and payment against the correct property.</p></div></div></aside>
  </div>
}

function Properties({notify,properties}) { return <section><div className="page-intro"><div><span className="eyebrow">{properties.length} {properties.length===1?'PROPERTY':'PROPERTIES'}</span><h2>Your rental portfolio</h2><p>Each property keeps its tenants, documents, money and history together.</p></div><button className="primary" onClick={()=>notify('Add-property form will open here')}><Plus size={18}/> Add property</button></div><div className="property-grid">{properties.map(p=><article className="wide-card" key={p.id}><div className={`property-image ${p.tone}`}><Building2 size={42}/></div><div className="wide-main"><span className="status">{p.status}</span><small>{p.area.toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div className="facts"><span><small>MONTHLY RENT</small><b>{p.rent}</b></span><span><small>LEASE ENDS</small><b>{p.lease}</b></span></div></div><button className="arrow"><ChevronRight/></button></article>)}</div></section> }

function Rent({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">GUIDED RENTAL JOURNEY</span><h2>Rent out with confidence</h2><p>Follow the correct steps from preparing your property to signing the lease.</p></div></div><div className="flow-grid">{flows.map(({icon:Icon,title,text},i)=><button className="flow-card" key={title} onClick={()=>notify(`${title} selected`)}><span className="step">{String(i+1).padStart(2,'0')}</span><Icon/><h3>{title}</h3><p>{text}</p><span className="open">Open guide <ChevronRight size={16}/></span></button>)}</div></section> }

function Maintenance({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">MAINTENANCE</span><h2>Issues and repairs</h2><p>Keep quotes, responsibility, follow-ups and proof in one timeline.</p></div><button className="primary" onClick={()=>notify('Maintenance form will open here')}><Plus size={18}/> Log issue</button></div><div className="empty-card"><ClipboardCheck/><h3>No open maintenance issues</h3><p>New tenant reports and issues you log will appear here.</p><button onClick={()=>notify('Secure link copied')}>Create tenant reporting link</button></div></section> }

function More({notify}) { const items=[[UserRound,'Applications','Review applicants and documents'],[ClipboardCheck,'Inspections','Ingoing, interim and outgoing'],[FilePenLine,'Documents','Leases, addendums and notices'],[WalletCards,'Rent & deposits','Payments and reconciliation'],[BookOpen,'Learn','Plain-language landlord guidance'],[ShieldCheck,'Settings','Account, security and subscription']]; return <section><div className="page-intro"><div><span className="eyebrow">MYRENTAL SA</span><h2>Tools and guidance</h2><p>Everything else you need to manage your rental properly.</p></div></div><div className="more-list">{items.map(([I,title,text])=><button key={title} onClick={()=>notify(`${title} selected`)}><span><I/></span><div><b>{title}</b><small>{text}</small></div><ChevronRight/></button>)}</div><div className="disclaimer"><AlertTriangle/><div><b>Legal guidance, not legal advice</b><p>MyRental SA provides guided workflows and educational information. Serious breaches, evictions and unusual circumstances should be reviewed by a qualified South African property attorney.</p></div></div></section> }

export default App
