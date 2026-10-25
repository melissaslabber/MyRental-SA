// CSV parsing and matching stay local until the member confirms an import.
export function csvRows(source,delimiter){
 if(source.length>5*1024*1024)throw new Error('Use a CSV statement up to 5 MB.')
 const text=source.replace(/^\uFEFF/,'')
 if(!delimiter){const lines=text.split(/\r?\n/).filter(Boolean).slice(0,15);delimiter=[',',';','\t'].sort((a,b)=>Math.max(...lines.map(l=>l.split(b).length))-Math.max(...lines.map(l=>l.split(a).length)))[0]}
 let rows=[],row=[],value='',quoted=false
 for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(char===delimiter&&!quoted){row.push(value);value=''}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value=''}else value+=char}
 if(quoted)throw new Error('The CSV has an unfinished quoted field. Export it again.')
 row.push(value);if(row.some(v=>v.trim()))rows.push(row)
 if(rows.length>10001)throw new Error('Import no more than 10,000 transactions at a time.')
 const headerIndex=rows.findIndex(r=>r.some(v=>/date/i.test(v))&&r.some(v=>/amount|credit|debit|deposit|withdrawal/i.test(v)))
 if(headerIndex<0)throw new Error('No transaction header found. Export CSV with date, description and amount columns.')
 return {headers:rows[headerIndex].map(v=>v.trim()),rows:rows.slice(headerIndex+1),delimiter}
}
export function guessColumns(headers){
 const index=regex=>String(headers.findIndex(h=>regex.test(h)))
 return {date:index(/^(transaction |posting |value )?date$/i),description:index(/description|narrative|details|reference/i),amount:index(/^(transaction )?amount$/i),credit:index(/credit|deposit|money in/i),debit:index(/debit|withdrawal|money out/i),balance:index(/balance/i),externalId:index(/transaction.?id|unique.?id/i),dateFormat:'DMY',decimal:'.'}
}
export function bankCents(raw,decimal='.'){
 let text=String(raw??'').trim();if(!text)return 0
 const negative=/^(?:ZAR|R)?\s*[-(]|DR$/i.test(text),positive=/CR$/i.test(text)
 if(negative&&positive)throw new Error('Conflicting amount signs')
 text=text.replace(/ZAR|R|CR|DR/gi,'').replace(/[\s()+-]/g,'')
 if(decimal===',')text=text.replace(/\./g,'').replace(',','.');else text=text.replace(/,/g,'')
 if(!/^\d{1,12}(\.\d{1,2})?$/.test(text))throw new Error('Invalid amount')
 const [whole,fraction='']=text.split('.'),amount=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(amount)||amount>100000000000)throw new Error('Amount is too large')
 return negative&&!positive?-amount:amount
}
export function bankDate(raw,format='DMY'){
 const text=String(raw||'').trim().split(/[ T]/)[0],parts=text.split(/[-/.]/);let year,month,day
 if(parts.length!==3)throw new Error('Invalid date')
 if(parts[0].length===4)[year,month,day]=parts;else if(format==='MDY')[month,day,year]=parts;else [day,month,year]=parts
 if(year.length!==4)throw new Error('Use a four-digit year')
 const iso=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`,parsed=new Date(`${iso}T12:00:00Z`)
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==iso)throw new Error('Invalid date')
 return iso
}
export function normaliseTransactions(rows,map,today){
 if(map.date==='-1'||map.description==='-1'||(map.amount==='-1'&&map.credit==='-1'&&map.debit==='-1'))throw new Error('Map the date, description and amount, or separate credit/debit columns.')
 const get=(row,key)=>Number(map[key])>=0?row[Number(map[key])]||'':''
 const transactions=rows.map((row,index)=>{try{
  const date=bankDate(get(row,'date'),map.dateFormat);if(date>today)throw new Error('Future transaction date')
  let amount;if(Number(map.amount)>=0)amount=bankCents(get(row,'amount'),map.decimal);else{const credit=Math.abs(bankCents(get(row,'credit'),map.decimal)),debit=Math.abs(bankCents(get(row,'debit'),map.decimal));if(credit&&debit)throw new Error('Both credit and debit are populated');amount=credit-debit}
  if(!amount)throw new Error('Zero or empty amount')
  const description=get(row,'description').trim();if(!description)throw new Error('Missing description')
  return {row:index+1,transaction_date:date,description:description.slice(0,500),amount:amount/100,balance:get(row,'balance').trim()?bankCents(get(row,'balance'),map.decimal)/100:null,external_id:get(row,'externalId').trim().slice(0,150)||null}
 }catch(e){return {row:index+1,error:e.message}}})
 const seen=new Map();for(const t of transactions.filter(t=>!t.error)){const key=transactionIdentity(t);seen.set(key,(seen.get(key)||0)+1)}
 return transactions.map(t=>!t.error&&seen.get(transactionIdentity(t))>1?{...t,error:'Repeated bank identity in this file. Map a running balance or unique transaction ID to distinguish these rows.'}:t)
}
export function transactionIdentity(t){return JSON.stringify(t.external_id?['id',t.external_id]:[t.transaction_date,t.description.trim().toLowerCase().replace(/\s+/g,' '),Math.round(t.amount*100),t.balance===null?null:Math.round(t.balance*100)])}
export async function transactionFingerprint(t){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(transactionIdentity(t)));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export function suggestedInvoices(transaction,invoices){
 if(transaction.amount<=0)return []
 const clean=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,''),description=clean(transaction.description)
 return invoices.map(invoice=>{const due=Math.round((invoice.rental_invoice_lines||[]).reduce((n,l)=>n+Math.round(Number(l.amount)*100),0)-(invoice.rental_invoice_payments||[]).reduce((n,p)=>n+Math.round(Number(p.amount)*100),0));const exactReference=description.includes(clean(invoice.invoice_number))&&clean(invoice.invoice_number).length>4;return {invoice,balance:due/100,score:(exactReference?100:0)+(due===Math.round(transaction.amount*100)?10:0)}}).filter(v=>v.balance>=transaction.amount&&v.score>0).sort((a,b)=>b.score-a.score)
}
