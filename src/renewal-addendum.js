export function renewalEnd(start,months){
 const d=new Date(`${start}T00:00:00Z`),n=Number(months)
 if(!Number.isInteger(n)||n<1||n>120||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==start)return ''
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n)
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()
 d.setUTCDate(Math.min(day,last));if(day<=last)d.setUTCDate(d.getUTCDate()-1)
 return d.toISOString().slice(0,10)
}
export function addendumText(f){
 if(!f.landlord?.trim()||!f.tenant?.trim()||!f.originalStart||!f.from||!f.to||f.to<f.from||f.originalStart>f.from||!Number.isInteger(Number(f.months))||Number(f.months)<1||Number(f.months)>120||renewalEnd(f.from,f.months)!==f.to||!Number.isFinite(Number(f.rent))||Number(f.rent)<=0||!Number.isFinite(Number(f.topUp||0))||Number(f.topUp||0)<0||Number(f.topUp||0)>0&&!f.depositDue)throw new Error('Complete the parties, original start date, matching renewal months/dates, positive rent and deposit top-up details.')
 const money=v=>Number(v||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})
 return `LEASE RENEWAL ADDENDUM\n\nLandlord: ${f.landlord}\nTenant(s): ${f.tenant}\nProperty: ${f.property}\nOriginal lease commencement date: ${f.originalStart}\n\n1. RENEWAL PERIOD\nThe parties agree to renew the above lease for ${f.months} months, from ${f.from} to ${f.to}, inclusive.\n\n2. MONTHLY RENT\nThe monthly rental will be R${money(f.rent)} from ${f.from}, payable on the due date and using the payment arrangements in the original lease unless changed below.\n\n3. DEPOSIT TOP-UP\n${Number(f.topUp||0)>0?`An additional deposit of R${money(f.topUp)} is payable by ${f.depositDue}. This is a top-up, not the total deposit. It must be held and accounted for with the existing deposit in accordance with applicable law.`:'No additional deposit payment is agreed under this addendum. Existing deposit and accrued interest remain subject to the original lease and applicable law.'}\n\n4. ADDITIONAL TERMS\n${f.terms?.trim()||'None.'}\n\n5. CONTINUING TERMS\nExcept for the changes expressly agreed in this addendum, the original lease remains unchanged. No provision overrides applicable law. This document records agreement only when signed by all required parties. Each party should retain a signed copy.\n\nLandlord signature: ______________________________\nName: ${f.landlord}\nDate: __________________   Place: __________________\n\nTenant signature(s): ______________________________\nName(s): ${f.tenant}\nDate: __________________   Place: __________________`
}
export async function addendumPdf(text,PDFLib){
 const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold)
 let page,y;const next=()=>{page=doc.addPage([595,842]);page.drawRectangle({x:0,y:754,width:595,height:88,color:rgb(.09,.15,.24)});page.drawText('MyRental SA',{x:42,y:797,size:22,font:bold,color:rgb(1,1,1)});page.drawText('LEASE RENEWAL ADDENDUM',{x:42,y:773,size:10,font:bold,color:rgb(.78,.66,.42)});y=727};next()
 const clean=text.normalize('NFKD').replace(/[^\x20-\x7E\n]/g,'')
 for(const paragraph of clean.split('\n')){if(paragraph.startsWith('Landlord signature:')&&y<230)next();let line='';const lines=[];for(const word of paragraph.split(' ')){if(font.widthOfTextAtSize(line+word,10)>505&&line){lines.push(line.trim());line=''}line+=word+' '}lines.push(line.trim());for(const value of lines){if(y<64)next();page.drawText(value,{x:42,y,size:10,font});y-=16}}
 doc.getPages().forEach((p,i)=>p.drawText(`Prepared with MyRental SA | Page ${i+1} of ${doc.getPageCount()}`,{x:42,y:30,size:8,font}))
 return doc.save()
}
