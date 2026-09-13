import { useMemo, useState } from 'react'
import {
  AlertTriangle, Bell, BookOpen, Building2, CalendarDays, ChevronRight,
  ClipboardCheck, FilePenLine, Hammer, Home, KeyRound, LayoutGrid,
  Link2, Menu, Plus, Receipt, Search, ShieldCheck, UserRound, WalletCards, X
} from 'lucide-react'

const properties = [
  { id: 1, name: '14 Protea Lane', area: 'Paarl', tenant: 'Johan & Mia Nel', rent: 'R14 500', status: 'Occupied', lease: '28 Feb 2027', tone: 'sage' },
  { id: 2, name: '7 Bergzicht Close', area: 'Wellington', tenant: 'Vacant', rent: 'R11 800', status: 'Preparing to rent', lease: '—', tone: 'sand' },
]

const tasks = [
  { icon: WalletCards, title: 'Rent payment due', detail: '14 Protea Lane · Due tomorrow', level: 'urgent' },
  { icon: ClipboardCheck, title: 'Schedule interim inspection', detail: '14 Protea Lane · Due in 6 days', level: 'high' },
  { icon: FilePenLine, title: 'Complete advertising checklist', detail: '7 Bergzicht Close', level: 'normal' },
]

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
  const [page, setPage] = useState('Today')
  const [quick, setQuick] = useState(false)
  const [toast, setToast] = useState('')
  const today = useMemo(() => new Intl.DateTimeFormat('en-ZA', { weekday:'long', day:'numeric', month:'long' }).format(new Date()), [])
  const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 2600) }

  const nav = [
    ['Today', Home], ['Properties', Building2], ['Rent', KeyRound], ['Maintenance', Hammer], ['More', Menu]
  ]

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <nav>{nav.map(([name, Icon]) => <button className={page===name?'active':''} onClick={()=>setPage(name)} key={name}><Icon size={19}/><span>{name}</span></button>)}</nav>
      <div className="legal-mini"><ShieldCheck size={18}/><p><b>Guidance you can trust</b><br/>Important legal matters are clearly flagged for professional review.</p></div>
      <button className="profile"><span>MS</span><div><b>Melissa</b><small>Landlord account</small></div></button>
    </aside>

    <main>
      <header><div className="mobile-brand"><Brand/></div><div><p>{today}</p><h1>{page === 'Today' ? 'Good morning, Melissa' : page}</h1></div><button className="icon-btn" aria-label="Notifications"><Bell size={21}/><i/></button></header>
      {page === 'Today' && <Today setPage={setPage} setQuick={setQuick}/>} 
      {page === 'Properties' && <Properties notify={notify}/>} 
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

function Today({setPage,setQuick}) {
  return <div className="page-grid">
    <section className="content-col">
      <div className="hero"><div><span className="eyebrow">YOUR RENTAL OVERVIEW</span><h2>Everything under control.</h2><p>Three items need your attention. We’ll guide you through each one.</p></div><button onClick={()=>setQuick(true)}><Plus size={18}/> Quick add</button></div>
      <div className="section-title"><div><span className="eyebrow">TODAY</span><h2>What needs your attention</h2></div><span className="count">3</span></div>
      <div className="task-list">{tasks.map(({icon:Icon,title,detail,level})=><button className="task" key={title}><span className={`task-icon ${level}`}><Icon size={19}/></span><div><b>{title}</b><small>{detail}</small></div><span className={`tag ${level}`}>{level}</span><ChevronRight size={18}/></button>)}</div>
      <div className="section-title spaced"><div><span className="eyebrow">YOUR PROPERTIES</span><h2>Portfolio</h2></div><button className="text-btn" onClick={()=>setPage('Properties')}>View all <ChevronRight size={16}/></button></div>
      <div className="property-row">{properties.map(p=><article className="property-card" key={p.id}><div className={`property-image ${p.tone}`}><Building2 size={32}/><span>{p.status}</span></div><div className="property-body"><small>{p.area.toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div><b>{p.rent}</b><span>per month</span></div></div></article>)}</div>
    </section>
    <aside className="right-col"><div className="guide-card"><span className="round-icon"><BookOpen/></span><span className="eyebrow">YOUR NEXT STEP</span><h3>Prepare 7 Bergzicht Close for advertising</h3><p>Complete the guided readiness checklist before creating your listing.</p><button onClick={()=>setPage('Rent')}>Continue checklist <ChevronRight size={17}/></button></div><div className="tip-card"><ShieldCheck/><div><b>Good to know</b><p>Store proof of every inspection, notice and payment against the correct property.</p></div></div></aside>
  </div>
}

function Properties({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">2 PROPERTIES</span><h2>Your rental portfolio</h2><p>Each property keeps its tenants, documents, money and history together.</p></div><button className="primary" onClick={()=>notify('Add-property form will open here')}><Plus size={18}/> Add property</button></div><div className="property-grid">{properties.map(p=><article className="wide-card" key={p.id}><div className={`property-image ${p.tone}`}><Building2 size={42}/></div><div className="wide-main"><span className="status">{p.status}</span><small>{p.area.toUpperCase()}</small><h3>{p.name}</h3><p>{p.tenant}</p><div className="facts"><span><small>MONTHLY RENT</small><b>{p.rent}</b></span><span><small>LEASE ENDS</small><b>{p.lease}</b></span></div></div><button className="arrow"><ChevronRight/></button></article>)}</div></section> }

function Rent({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">GUIDED RENTAL JOURNEY</span><h2>Rent out with confidence</h2><p>Follow the correct steps from preparing your property to signing the lease.</p></div></div><div className="flow-grid">{flows.map(({icon:Icon,title,text},i)=><button className="flow-card" key={title} onClick={()=>notify(`${title} selected`)}><span className="step">{String(i+1).padStart(2,'0')}</span><Icon/><h3>{title}</h3><p>{text}</p><span className="open">Open guide <ChevronRight size={16}/></span></button>)}</div></section> }

function Maintenance({notify}) { return <section><div className="page-intro"><div><span className="eyebrow">MAINTENANCE</span><h2>Issues and repairs</h2><p>Keep quotes, responsibility, follow-ups and proof in one timeline.</p></div><button className="primary" onClick={()=>notify('Maintenance form will open here')}><Plus size={18}/> Log issue</button></div><article className="maintenance-card"><span className="task-icon high"><Hammer/></span><div><span className="tag high">AWAITING QUOTE</span><h3>Kitchen tap leaking</h3><p>14 Protea Lane · Reported by tenant</p><small>Last followed up: 12 September</small></div><button className="arrow"><ChevronRight/></button></article><div className="empty-card"><ClipboardCheck/><h3>No other open issues</h3><p>New tenant reports will appear here automatically.</p><button onClick={()=>notify('Secure link copied')}>Create tenant reporting link</button></div></section> }

function More({notify}) { const items=[[UserRound,'Applications','Review applicants and documents'],[ClipboardCheck,'Inspections','Ingoing, interim and outgoing'],[FilePenLine,'Documents','Leases, addendums and notices'],[WalletCards,'Rent & deposits','Payments and reconciliation'],[BookOpen,'Learn','Plain-language landlord guidance'],[ShieldCheck,'Settings','Account, security and subscription']]; return <section><div className="page-intro"><div><span className="eyebrow">MYRENTAL SA</span><h2>Tools and guidance</h2><p>Everything else you need to manage your rental properly.</p></div></div><div className="more-list">{items.map(([I,title,text])=><button key={title} onClick={()=>notify(`${title} selected`)}><span><I/></span><div><b>{title}</b><small>{text}</small></div><ChevronRight/></button>)}</div><div className="disclaimer"><AlertTriangle/><div><b>Legal guidance, not legal advice</b><p>MyRental SA provides guided workflows and educational information. Serious breaches, evictions and unusual circumstances should be reviewed by a qualified South African property attorney.</p></div></div></section> }

export default App
