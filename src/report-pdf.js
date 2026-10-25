// A real paginated PDF, independent of browser print windows.
const clean=value=>String(value??'').normalize('NFKD').replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x20-\x7e\n]/g,'')
export async function reportPdf(text,PDFLib,title='PROPERTY REPORT',photos=[]){
 const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold)
 let page,y;const next=()=>{page=doc.addPage([595,842]);page.drawRectangle({x:0,y:754,width:595,height:88,color:rgb(.09,.15,.24)});page.drawText('MyRental SA',{x:42,y:797,size:22,font:bold,color:rgb(1,1,1)});let heading=clean(title);while(bold.widthOfTextAtSize(heading,10)>505)heading=heading.slice(0,-1);page.drawText(heading,{x:42,y:773,size:10,font:bold,color:rgb(.78,.66,.42)});y=727};next()
 const line=value=>{if(y<64)next();page.drawText(value,{x:42,y,size:10,font});y-=16}
 for(const paragraph of clean(text).split('\n')){
  if(paragraph.startsWith('Landlord name:')&&y<230)next()
  // Break long notes/URLs as well as normal sentences within the page margins.
  let current=''
  for(const char of paragraph){if(font.widthOfTextAtSize(current+char,10)>505){const split=current.lastIndexOf(' ');if(split>0){line(current.slice(0,split));current=current.slice(split+1)}else{line(current);current=''}}current+=char}
  line(current)
 }
 for(const photo of photos){
  next();line(`PHOTOGRAPH - ${clean(photo.area)}`)
  const image=photo.mime==='image/png'?await doc.embedPng(photo.bytes):await doc.embedJpg(photo.bytes)
  const size=image.scale(Math.min(505/image.width,470/image.height));page.drawImage(image,{x:42,y:y-size.height,width:size.width,height:size.height});y-=size.height+22
  for(const caption of clean(photo.caption||photo.name||'No caption recorded').match(/.{1,85}/g)||[])line(caption)
 }
 doc.getPages().forEach((p,i)=>p.drawText(`Prepared with MyRental SA | Page ${i+1} of ${doc.getPageCount()}`,{x:42,y:30,size:8,font}))
 return doc.save()
}
export function reportElementText(element){
 if(!element)throw new Error('The report is still loading. Please try again.')
 const copy=element.cloneNode(true);copy.querySelectorAll('.no-print,button').forEach(n=>n.remove())
 // textContent joins adjacent paragraphs: collect each block separately instead.
 return [...copy.querySelectorAll('h1,h2,h3,p,header,footer,li,tr,.expense-breakdown>div,.finance-summary article')].map(n=>n.tagName==='TR'?[...n.querySelectorAll('th,td')].map(cell=>cell.textContent.trim()).join(' | '):n.textContent.trim()).filter(Boolean).join('\n\n')
}
