import test from 'node:test'
import assert from 'node:assert/strict'
import {csvRows,guessColumns,bankDate,bankCents,normaliseTransactions,transactionFingerprint,suggestedInvoices} from '../src/bank-import.js'
test('bank CSV handles preambles, BOM, quotes and semicolon debit/credit exports',()=>{
 const csv='\uFEFFAccount statement\r\nDate;Description;Debit;Credit;Balance\r\n25/10/2026;"Rent; Cottage";;1 000,00;3 000,00\r\n24/10/2026;"Plumber ""repair""";250,00;;2 000,00'
 const parsed=csvRows(csv,';'),map={...guessColumns(parsed.headers),decimal:','},rows=normaliseTransactions(parsed.rows,map,'2026-10-25')
 assert.equal(rows[0].description,'Rent; Cottage');assert.equal(rows[0].amount,1000);assert.equal(rows[1].amount,-250);assert.equal(rows[1].description,'Plumber "repair"')
 assert.throws(()=>csvRows('Date,Description,Amount\n"unfinished'),/unfinished/)
})
test('dates and amounts are explicit and invalid rows never become payments',()=>{
 assert.equal(bankCents('R -1,234.56'),-123456);assert.equal(bankCents('100.00 DR'),-10000);assert.equal(bankCents('(1.234,56)',','),-123456)
 assert.equal(bankDate('10/11/2026','DMY'),'2026-11-10');assert.equal(bankDate('10/11/2026','MDY'),'2026-10-11')
 assert.throws(()=>bankDate('31/02/2026'));assert.throws(()=>bankCents('1.234'));assert.throws(()=>bankCents('-10 CR'))
 const p=csvRows('Date,Description,Amount\n26/10/2026,Future,100\n25/10/2026,Rent,0');assert(normaliseTransactions(p.rows,guessColumns(p.headers),'2026-10-25').every(r=>r.error))
})
test('duplicate identity is stable across imports and ambiguous repeats require bank identity',async()=>{
 const p=csvRows('Date,Description,Amount,Balance\n25/10/2026,Rent,100,1000\n25/10/2026,Rent,100,1100'),map=guessColumns(p.headers),rows=normaliseTransactions(p.rows,map,'2026-10-25')
 assert(!rows.some(r=>r.error));assert.notEqual(await transactionFingerprint(rows[0]),await transactionFingerprint(rows[1]));assert.equal(await transactionFingerprint(rows[0]),await transactionFingerprint({...rows[0],row:12}))
 assert(normaliseTransactions(p.rows,{...map,balance:'-1'},'2026-10-25').every(r=>r.error))
})
test('invoice suggestions use outstanding balances and never suggest debits or paid invoices',()=>{
 const invoice={id:'i',invoice_number:'MR-202610-TEST',rental_invoice_lines:[{amount:1000}],rental_invoice_payments:[{amount:200}]},tx={description:'MR 202610 TEST rent',amount:800}
 assert.equal(suggestedInvoices(tx,[invoice])[0].invoice.id,'i');assert.equal(suggestedInvoices({...tx,amount:-800},[invoice]).length,0)
 invoice.rental_invoice_payments.push({amount:800});assert.equal(suggestedInvoices(tx,[invoice]).length,0)
})
