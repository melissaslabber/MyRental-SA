export function amountCents(value,label='Amount'){
 const text=String(value??'').trim()||'0'
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(text))throw new Error(`${label} must be a positive amount or zero, with no more than two decimal places.`)
 const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'))
}
export function reconcileDeposit(form){
 const held=amountCents(form.held,'Deposit held'),topups=amountCents(form.topups,'Deposit top-ups'),interest=amountCents(form.interest,'Interest'),prior=amountCents(form.priorRefunds,'Previous refunds')
 const deductions=(form.deductions||[]).reduce((sum,item)=>{const amount=amountCents(item.amount,'Deduction');if(amount&&!item.reason?.trim())throw new Error('Describe every proposed deduction.');return sum+amount},0)
 const available=held+topups+interest-prior;if(available<0)throw new Error('Previous refunds exceed the deposit, top-ups and interest recorded.')
 const balance=available-deductions
 return {held,topups,interest,prior,deductions,available,refund:Math.max(balance,0),shortfall:Math.max(-balance,0)}
}
export const depositMoney=cents=>`R${(cents/100).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}`
export function depositStatement(property,lease,form,documents=[]){
 const total=reconcileDeposit(form)
 return `DEPOSIT RECONCILIATION\n\nProperty: ${property.name}\nTenant: ${lease.tenant_name||'Not recorded'}\nLease: ${lease.start_date||'Not recorded'} - ${lease.end_date||'Ongoing'}\nStatement date: ${form.date||'Not recorded'}\nStatus: ${form.status||'draft'}\n\nDeposit actually held (excluding top-ups): ${depositMoney(total.held)}\nAdditional top-ups held: ${depositMoney(total.topups)}\nInterest from statement: ${depositMoney(total.interest)}\nRefunds already paid: ${depositMoney(total.prior)}\nAvailable to reconcile: ${depositMoney(total.available)}\n\nPROPOSED DEDUCTIONS\n${(form.deductions||[]).map((d,i)=>`${i+1}. ${d.reason||'Unspecified'} - ${depositMoney(amountCents(d.amount))}\nEvidence: ${(d.evidenceIds||[]).map(id=>documents.find(doc=>doc.id===id)?.title||'Saved file').join('; ')||'No supporting file selected'}\nNotes: ${d.notes||'None'}`).join('\n\n')||'No deductions recorded.'}\n\nTotal proposed deductions: ${depositMoney(total.deductions)}\nRefund balance: ${depositMoney(total.refund)}${total.shortfall?`\nAmount exceeding funds held: ${depositMoney(total.shortfall)} (requires separate review; not an automatic debt finding)`:''}\n\nRefund date: ${form.refundDate||'Not recorded'}\nRefund reference: ${form.refundReference||'Not recorded'}\nNotes / tenant response: ${form.notes||'None recorded'}\n\nDeposit / interest statements: ${(form.statementEvidenceIds||[]).map(id=>documents.find(d=>d.id===id)?.title||'Saved file').join('; ')||'None linked'}\n\nThis statement records amounts supplied by the landlord. Proposed deductions require lawful grounds and evidence. It does not approve deductions or transfer money.`
}
