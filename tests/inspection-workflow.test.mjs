import test from 'node:test'
import assert from 'node:assert/strict'
import * as PDFLib from 'pdf-lib'
import {selectedAreas,makeArea,inspectionText,inspectionProgress,compareInspections} from '../src/inspection-model.js'
import {reportPdf} from '../src/report-pdf.js'
import {inspectionPhotos} from '../src/inspection-photos.js'
const property={name:'Test Cottage',address:'Test address'}
test('selected rooms create only requested areas with quantities and specific items',()=>{
 const areas=selectedAreas({kitchen:1,bedroom:3,bathroom:2,pool:1})
 assert.equal(areas.length,7);assert.equal(areas.filter(a=>a.type==='bedroom').length,3)
 assert(areas.find(a=>a.type==='kitchen').items.some(i=>i.name==='Oven'))
 assert(areas.find(a=>a.type==='pool').items.some(i=>i.name==='Pump'))
 assert(!areas.some(a=>a.type==='garage'));assert(areas.every(a=>a.items.every(i=>i.condition==='Not checked')))
 assert.throws(()=>selectedAreas({}),/at least one/);assert.throws(()=>selectedAreas({bedroom:1.5}),/whole number/)
 assert.throws(()=>selectedAreas({bedroom:21}),/whole number/)
})
test('updating area selection preserves notes, photo references, custom and legacy rooms',()=>{
 const areas=selectedAreas({bedroom:2});areas[0].items[0].notes='Existing ceiling crack';areas[0].images=[{path:'private/photo.jpg'}]
 const custom=makeArea('living','Custom loft'),next=selectedAreas({bedroom:1,kitchen:1},[...areas,custom])
 assert.equal(next.find(a=>a.id===areas[0].id),areas[0]);assert.equal(next.find(a=>a.id===areas[0].id).images.length,1);assert(next.includes(custom));assert(!next.includes(areas[1]))
})
test('completion requires checked items, parties/date and explicit review of missing photographs',()=>{
 const form={areas:selectedAreas({kitchen:1}),date:'',tenant:''}
 assert(inspectionProgress(form).unchecked>0);assert(!inspectionProgress(form).canComplete)
 form.date='2026-10-25';form.tenant='Test tenant';form.areas[0].items.forEach(i=>i.condition='Not applicable')
 assert(!inspectionProgress(form).canComplete);form.photosReviewed=true;assert(inspectionProgress(form).canComplete)
})
test('comparison matches generated areas, changed notes, missing rooms and unreviewed conditions',()=>{
 const before={areas:selectedAreas({bedroom:2})},after={areas:structuredClone(before.areas)}
 after.areas[0].items[0].condition='Damaged';after.areas[0].items[0].notes='New mark';after.areas.pop()
 const result=compareInspections(before,after);assert.equal(result[0].items.filter(i=>i.changed).length,1)
 assert.equal(result[1].after,undefined);assert(result[1].items.every(i=>i.changed));assert.equal(result[0].items[1].after.condition,'Not checked')
})
test('inspection and long document PDFs have readable page structures and photo appendix',async()=>{
 const form={type:'outgoing',date:'2026-10-25',tenant:'Test Tenant',status:'draft',areas:selectedAreas({kitchen:1,bedroom:2}),landlordNotes:'Long note '+('Long detailed note. '.repeat(80))}
 const text=inspectionText(property,form);assert(text.includes('Bedroom 2'));assert(!text.includes('Garage'));assert(text.includes('Not checked'))
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgNsAAAAASUVORK5CYII=','base64'))
 const bytes=await reportPdf(text+'\n'+('W'.repeat(1000)),PDFLib,'OUTGOING INSPECTION REPORT',[{bytes:png,mime:'image/png',area:'Kitchen',caption:'Test evidence photograph'}])
 assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');const doc=await PDFLib.PDFDocument.load(bytes);assert(doc.getPageCount()>2)
 assert(doc.getPages().at(-1).node.Resources().get(PDFLib.PDFName.of('XObject')))
})
test('photo export fails visibly instead of silently omitting inaccessible evidence',async()=>{
 await assert.rejects(inspectionPhotos({areas:[{name:'Kitchen',images:[{path:'private/missing.jpg'}]}]},{createSignedUrl:async()=>({error:{message:'expired'}})}),/Could not load a photograph for Kitchen/)
})
