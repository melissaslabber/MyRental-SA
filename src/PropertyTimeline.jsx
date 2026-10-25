import {useState} from 'react'
import {propertyTimeline} from './property-timeline'
export function PropertyTimeline({property,data,onOpen}){
 const [filter,setFilter]=useState('All'),[limit,setLimit]=useState(30),events=propertyTimeline(property,data),visible=events.filter(e=>filter==='All'||e.kind===filter)
 return <section><h3>Property timeline</h3><p>Leases, inspections, invoices, payments, documents and repairs from your saved property records.</p><label>Show<select value={filter} onChange={e=>{setFilter(e.target.value);setLimit(30)}}>{['All',...new Set(events.map(e=>e.kind))].map(x=><option key={x}>{x}</option>)}</select></label><div className="property-timeline">{visible.slice(0,limit).map(event=><button type="button" key={event.key} onClick={()=>onOpen(event.tab)}><small>{event.date.slice(0,10)} · {event.kind}</small><b>{event.title}</b><span>{event.detail}</span></button>)}</div>{!visible.length&&<p>No saved activity in this category yet.</p>}{visible.length>limit&&<button className="secondary" onClick={()=>setLimit(limit+30)}>Show more activity</button>}</section>
}
