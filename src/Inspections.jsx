import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, FileDown, Info, Plus, ShieldCheck, Trash2 } from 'lucide-react'

const DEFAULT_AREAS=['Entrance / passage','Lounge / living area','Kitchen','Main bedroom','Bedroom 2','Bathroom','Exterior / garden','Garage / parking','Meters, keys and remotes']
const PHOTO_EXAMPLES=[
  ['Room overview','Stand in each corner and take wide, well-lit photographs showing the whole room.'],
  ['Existing damage','Take a close-up and a wider context photograph. Point to size/location and describe it in writing.'],
  ['Fixtures and appliances','Photograph inside and outside, model/serial numbers where relevant, and test whether each item works.'],
  ['Meters, keys and remotes','Photograph readable meter displays and lay out every key/remote so the quantity is visible.']
]

const GUIDES={
  ingoing:{title:'Ingoing inspection',intro:'Complete jointly with the tenant before the tenant moves in. Record every existing defect or item of damage and agree who will attend to it.',steps:['Clean and prepare the property, test services and remove unwanted items.','Walk through together in good daylight before keys are handed over.','Work room by room—never write only “good condition”. Describe surfaces, fixtures and defects.','Take dated overview and close-up photographs and record meter readings, keys and remotes.','Let the tenant add comments or corrections. Both parties should initial changes and sign the completed report.','Give the tenant a copy and store the signed report and original photographs safely.']},
  interim:{title:'Interim inspection',intro:'Use an interim inspection to identify maintenance early. Respect the tenant’s privacy and arrange reasonable access in advance.',steps:['Agree a reasonable date and time with the tenant and keep proof of the arrangement.','Use the ingoing report as the baseline; focus on maintenance, safety and developing deterioration.','Distinguish fair wear and tear, landlord maintenance and possible tenant-caused damage—do not decide from a photograph alone.','Photograph only what is relevant to the property condition; avoid personal belongings and private information where possible.','Record repairs, responsibility still to be confirmed, target dates and follow-up actions.','Share the report with the tenant and invite written comments.']},
  outgoing:{title:'Outgoing inspection',intro:'Arrange a joint inspection at a mutually convenient time within the three days before the lease expires. Compare the property against the signed ingoing report.',steps:['Beforehand, send the tenant the date/time request and a move-out checklist; ask that the property be empty and reasonably clean.','Bring the ingoing report, interim reports, lease, key list and original photographs.','Inspect the same areas in the same order and recreate similar photograph angles where possible.','Record final meter readings and every returned key, remote and access device.','Separate pre-existing defects and fair wear and tear from possible new damage. Do not estimate deductions without supporting evidence.','Both parties should record disagreements, sign the report and retain copies. Obtain quotations/invoices and professional advice before disputed deductions.']}
}

const blankCondition=()=>({condition:'',defects:'',action:'',photos:''})

export function InspectionModule({properties,notify}){
  const [propertyId,setPropertyId]=useState(properties[0]?.id||'')
  const [type,setType]=useState('ingoing')
  const property=properties.find(p=>p.id===propertyId)
  const storageKey=`myrental_inspection_${propertyId}_${type}`
  const empty=()=>({date:'',tenant:property?.activeLease?.tenant_name||'',areas:DEFAULT_AREAS.map(name=>({id:crypto.randomUUID(),name,...blankCondition()})),landlordNotes:'',tenantNotes:''})
  const load=()=>{try{return JSON.parse(localStorage.getItem(storageKey))||empty()}catch{return empty()}}
  const [form,setForm]=useState(load)
  useEffect(()=>{setForm(load())},[propertyId,type])
  useEffect(()=>{if(propertyId)localStorage.setItem(storageKey,JSON.stringify(form))},[form,storageKey,propertyId])
  const update=(key,value)=>setForm(v=>({...v,[key]:value}))
  const updateArea=(id,key,value)=>setForm(v=>({...v,areas:v.areas.map(a=>a.id===id?{...a,[key]:value}:a)}))
  const addArea=()=>setForm(v=>({...v,areas:[...v.areas,{id:crypto.randomUUID(),name:'New area',...blankCondition()}]}))
  const removeArea=id=>setForm(v=>({...v,areas:v.areas.filter(a=>a.id!==id)}))
  const guide=GUIDES[type]
  if(!properties.length)return <section><div className="page-intro"><div><span className="eyebrow">INSPECTIONS</span><h2>Add a property first</h2><p>Your inspection form will be customised to the selected property.</p></div></div></section>
  return <section className="inspection-page">
    <div className="page-intro no-print"><div><span className="eyebrow">GUIDED PROPERTY RECORD</span><h2>Property inspections</h2><p>Create a detailed, property-specific inspection report and keep reliable evidence.</p></div></div>
    <div className="inspection-tabs no-print">{Object.entries(GUIDES).map(([key,g])=><button className={type===key?'active':''} onClick={()=>setType(key)} key={key}>{g.title}</button>)}</div>
    <article className="legal-inspection-note no-print"><ShieldCheck/><div><b>{guide.title}: important</b><p>{guide.intro}</p></div></article>
    <div className="inspection-layout">
      <div className="inspection-builder">
        <div className="inspection-basics no-print"><label>Property<select value={propertyId} onChange={e=>setPropertyId(e.target.value)}>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Inspection date<input type="date" value={form.date} onChange={e=>update('date',e.target.value)}/></label><label>Tenant name<input value={form.tenant} onChange={e=>update('tenant',e.target.value)}/></label></div>
        <div className="inspection-form-head"><div><span className="eyebrow">{type.toUpperCase()} REPORT</span><h2>{property?.name}</h2><p>{[property?.address,property?.suburb,property?.province].filter(Boolean).join(', ')}</p></div><button className="print-inspection no-print" onClick={()=>window.print()}><FileDown/>Save / print PDF</button></div>
        <div className="area-list">{form.areas.map((area,index)=><article className="inspection-area" key={area.id}><div className="area-title"><span>{index+1}</span><input aria-label="Area name" value={area.name} onChange={e=>updateArea(area.id,'name',e.target.value)}/><button className="no-print" aria-label={`Remove ${area.name}`} onClick={()=>removeArea(area.id)}><Trash2/></button></div><div className="area-fields"><label>Condition and cleanliness<textarea value={area.condition} onChange={e=>updateArea(area.id,'condition',e.target.value)} placeholder="Example: Walls clean; paint intact except for two small marks near the door."/></label><label>Defects or damage<textarea value={area.defects} onChange={e=>updateArea(area.id,'defects',e.target.value)} placeholder="Describe exact location, type and approximate size."/></label><label>Action / responsibility to confirm<textarea value={area.action} onChange={e=>updateArea(area.id,'action',e.target.value)} placeholder="Repair needed, person responsible and target date."/></label><label>Photo references<textarea value={area.photos} onChange={e=>updateArea(area.id,'photos',e.target.value)} placeholder="Example: IMG_104–IMG_110; overview, wall mark and window latch."/></label></div></article>)}</div>
        <button className="add-area no-print" onClick={addArea}><Plus/>Add room or area</button>
        <div className="inspection-signoff"><label>Landlord comments<textarea value={form.landlordNotes} onChange={e=>update('landlordNotes',e.target.value)}/></label><label>Tenant comments / disagreements<textarea value={form.tenantNotes} onChange={e=>update('tenantNotes',e.target.value)}/></label><div className="signature-lines"><span>Landlord name and signature<b/></span><span>Tenant name and signature<b/></span><span>Date<b/></span></div><p>Each party should receive a complete signed copy together with the referenced photographs.</p></div>
      </div>
      <aside className="inspection-guide no-print"><span className="eyebrow">HOW TO COMPLETE IT</span><h2>{guide.title}</h2>{guide.steps.map((step,i)=><div className="guide-step" key={step}><span>{i+1}</span><p>{step}</p></div>)}</aside>
    </div>
    <section className="photo-guidance no-print"><div className="photo-heading"><Camera/><div><span className="eyebrow">PHOTOGRAPHIC EVIDENCE</span><h2>How to photograph the property</h2><p>Keep original, full-resolution files. Do not edit them. Make sure the report’s photo references match the stored images.</p></div></div><div className="photo-examples">{PHOTO_EXAMPLES.map(([title,text])=><article key={title}><div className="example-frame"><Camera/><span>Example</span></div><h3>{title}</h3><p>{text}</p></article>)}</div><div className="photo-rule"><CheckCircle2/><p>Photograph ceilings, walls, floors, doors, windows, cupboards, sanitaryware, appliances, exterior areas, meters and every defect. Capture both context and detail.</p></div></section>
    {type==='ingoing'&&<article className="signature-warning no-print"><AlertTriangle/><div><b>Do not leave the ingoing report unsigned</b><p>A joint, signed report is powerful evidence of the condition agreed at occupation. An unsigned or incomplete report can create factual disputes and weaken a party’s position if a deposit or damage dispute reaches a Rental Housing Tribunal. Record any refusal to sign and obtain legal advice; the app cannot determine the outcome of a dispute.</p></div></article>}
    {type==='outgoing'&&<article className="signature-warning no-print"><AlertTriangle/><div><b>Outgoing inspection deadline matters</b><p>The landlord should arrange the joint outgoing inspection within the three days before the lease expires. The legal consequences of a missed inspection can be serious. If the tenant does not respond or attend, retain proof of the request and obtain advice on the correct inspection and deposit process.</p></div></article>}
    <article className="inspection-disclaimer no-print"><Info/><p><b>Helpful guidance, not legal advice.</b> The lease, facts and applicable law must be considered. For disputed damage, deposit deductions, access problems or missed statutory steps, consult a qualified South African property attorney or the Rental Housing Tribunal.</p></article>
  </section>
}
