import {createId} from './ids.js'
const COMMON=['Ceiling','Walls','Floor','Windows','Doors','Electrical points and lights','Blinds / curtain rods','Air-conditioners','Remotes and keys']
export const AREA_TYPES={
 living:{label:'Living area / passage',items:COMMON},
 kitchen:{label:'Kitchen',items:[...COMMON,'Oven','Stove / hob','Extractor fan','Worktops','Cupboards inside','Cupboards outside','Sink','Taps','Washing-machine connection']},
 bathroom:{label:'Bathroom',items:[...COMMON,'Shower','Toilet','Bath','Basin','Mirror','Extractor fan','Cupboard / vanity']},
 bedroom:{label:'Bedroom',items:[...COMMON,'Built-in cupboards inside','Built-in cupboards outside']},
 braai:{label:'Braai room / area',items:[...COMMON,'Sink','Taps','Built-in braai','Braai grid and accessories']},
 exterior:{label:'Exterior / garden',items:['Roof','Gutters and downpipes','Garden','Gates and motors','Boundary walls / fences','Exterior property walls','Paving / pathways','Outside taps and drains']},
 garage:{label:'Garage / parking',items:[...COMMON,'Garage door','Garage-door motor','Garage remotes','Shelving / cupboards']},
 pool:{label:'Pool / spa',items:['Pool surface','Water condition','Pump','Filter','Pool cleaner','Safety fence / cover','Pool lights','Pipes and leaks']},
 laundry:{label:'Laundry / scullery',items:[...COMMON,'Sink','Taps','Cupboards','Washing-machine connection','Drainage']},
 outdoor:{label:'Patio / balcony / deck',items:['Surface / flooring','Walls','Roof / cover','Railings and balustrades','Steps','Drains','Lights','Doors and locks']},
 systems:{label:'General home systems',items:['Alarm system','Alarm keypad / remotes','Irrigation system','Irrigation controller','Electric fence / energiser','Intercom / access system','Electricity meter','Water meter','Main keys and access remotes','Geyser','Solar panels / inverter / battery']}
}
export const AREA_OPTIONS=[
 ['entrance','Entrance / passage','living'],['lounge','Lounge / living room','living'],['dining','Dining room','living'],['kitchen','Kitchen','kitchen'],
 ['bedroom','Bedroom','bedroom',true],['bathroom','Bathroom / en-suite','bathroom',true],['guest','Guest toilet','bathroom'],['study','Study / office','living'],['laundry','Laundry / scullery','laundry'],['braai','Braai room / area','braai'],['garage','Garage','garage',true],['parking','Carport / parking','garage'],['patio','Patio / stoep','outdoor'],['balcony','Balcony / deck','outdoor'],['garden','Exterior / garden','exterior'],['pool','Pool / spa','pool'],['outbuilding','Flatlet / outbuilding','living',true],['systems','General home systems','systems']
].map(([key,label,type,repeat=false])=>({key,label,type,repeat}))
export const makeItem=name=>({id:createId(),name,condition:'Not checked',notes:''})
export const makeArea=(type='living',name)=>({id:createId(),type,name:name||AREA_TYPES[type].label,items:AREA_TYPES[type].items.map(makeItem),notes:'',action:'',images:[]})
export function selectedAreas(counts,previous=[]){
 const result=[]
 for(const option of AREA_OPTIONS){const count=Number(counts[option.key]||0);if(!Number.isInteger(count)||count<0||count>(option.repeat?20:1))throw new Error('Choose a whole number from 1 to 20 for each selected room type.')
  for(let i=0;i<count;i++){const selectionKey=`${option.key}:${i}`,old=previous.find(a=>a.selectionKey===selectionKey);result.push(old||{...makeArea(option.type,option.repeat?`${option.label} ${i+1}`:option.label),selectionKey})}
 }
 // Custom and legacy rooms stay intact when updating an existing report.
 result.push(...previous.filter(a=>!a.selectionKey))
 if(!result.length)throw new Error('Select at least one room or area to create your inspection report.')
 return result
}
export function inspectionText(property,form){
 const title=`${form.type||'ingoing'} inspection`.toUpperCase()
 return `${title}\n\nProperty: ${property.name}\nAddress: ${[property.address,property.suburb,property.province].filter(Boolean).join(', ')}\nInspection date: ${form.date||'Not recorded'}\nTenant: ${form.tenant||'Not recorded'}\nReport status: ${form.status||'draft'} (signatures recorded separately)\nAreas included: ${form.areas.length}\n\n${form.areas.map((a,i)=>`${i+1}. ${a.name}\n${a.items.map(item=>`${item.name}: ${item.condition||'Not checked'}${item.notes?' - '+item.notes:''}`).join('\n')}\nGeneral notes: ${a.notes||'None recorded'}\nRepairs / action: ${a.action||'None recorded'}\nPhotographs: ${(a.images||[]).length}`).join('\n\n')}\n\nLandlord comments: ${form.landlordNotes||'None recorded'}\nTenant comments / disagreements: ${form.tenantNotes||'None recorded'}\n\nLandlord name: __________________________\nLandlord signature: ______________________\nTenant name: ____________________________\nTenant signature: ________________________\nDate: __________________________________\n\nBoth parties should receive the complete signed report and referenced photographs. Not checked is not a finding that an item is in good condition.`
}
export function inspectionProgress(form){
 const items=form.areas.flatMap(a=>a.items||[]),unchecked=items.filter(i=>!i.condition||i.condition==='Not checked').length
 const missingPhotos=form.areas.filter(a=>!(a.images||[]).length).map(a=>a.name)
 const missingDetails=[];if(!form.date)missingDetails.push('inspection date');if(!form.tenant?.trim())missingDetails.push('tenant name');if(!form.areas.length)missingDetails.push('rooms / areas')
 return {total:items.length,checked:items.length-unchecked,unchecked,missingPhotos,missingDetails,canComplete:items.length>0&&!unchecked&&!missingDetails.length&&(!missingPhotos.length||!!form.photosReviewed)}
}
const normal=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ')
export function compareInspections(before,after){
 const old=before?.areas||[],next=after?.areas||[],used=new Set()
 const pairs=old.map(a=>{const b=next.find(n=>!used.has(n.id)&&((a.selectionKey&&a.selectionKey===n.selectionKey)||normal(a.name)===normal(n.name)));if(b)used.add(b.id);return [a,b]})
 pairs.push(...next.filter(a=>!used.has(a.id)).map(a=>[null,a]))
 return pairs.map(([a,b])=>{const names=[...new Set([...(a?.items||[]).map(i=>i.name),...(b?.items||[]).map(i=>i.name)])];return {name:b?.name||a.name,before:a,after:b,items:names.map(name=>{const x=a?.items.find(i=>normal(i.name)===normal(name)),y=b?.items.find(i=>normal(i.name)===normal(name));return {name,before:x,after:y,changed:!x||!y||x.condition!==y.condition||normal(x.notes)!==normal(y.notes)}})}})
}
