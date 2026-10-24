import test from 'node:test'
import assert from 'node:assert/strict'
import {periodEnd,nextBillingDate,money,publicSubscription,validNotification} from '../supabase/functions/membership/rules.js'
import {signature,notificationSignature,parameterString} from '../supabase/functions/membership/payfast.js'
test('monthly billing clamps month-end in Johannesburg time',()=>{assert.equal(periodEnd('2026-01-31T09:00:00Z'),'2026-02-28T09:00:00.000Z');assert.equal(periodEnd('2028-01-31T22:00:00Z'),'2028-02-29T22:00:00.000Z');assert.equal(periodEnd('2026-12-30T22:00:00Z'),'2027-01-30T22:00:00.000Z')})
test('invalid dates and nondecimal currency are rejected',()=>{assert.throws(()=>periodEnd('bad'));for(const v of ['NaN','89abc','89.001','','1e2'])assert.throws(()=>money(v));assert.equal(money('89.00'),89);assert.equal(money('-2.34'),-2.34)})
test('public status never includes provider tokens or checkout references',()=>{const s=publicSubscription({id:'x',status:'active',amount:'89',provider_token:'secret',payment_reference:'private'});assert.equal(s.amount,89);assert.equal(s.provider_token,undefined);assert.equal(s.payment_reference,undefined)})
test('PayFast encoding preserves field order and escapes form characters',()=>{assert.equal(parameterString({name_first:'A B',empty:'',item:'a+b~'}),'name_first=A+B&item=a%2Bb%7E');assert.notEqual(signature({a:'x',b:'y'},'secret'),signature({b:'y',a:'x'},'secret'))})
test('notification signing preserves empty fields and whitespace',()=>{assert.notEqual(notificationSignature({a:'x',empty:'',signature:'ignored'},'p'),signature({a:'x',empty:''},'p'));assert.notEqual(notificationSignature({a:' x ',signature:''}),notificationSignature({a:'x',signature:''}))})
test('webhooks require merchant, reference, explicit amount, signature and known status',()=>{const f={merchant_id:'123',m_payment_id:'MRSA-11111111-1111-4111-8111-111111111111',pf_payment_id:'123456',payment_status:'COMPLETE',amount_gross:'89.00',signature:'a'.repeat(32)};assert.equal(validNotification(f,'123'),true);for(const edit of [{merchant_id:'456'},{m_payment_id:'RISE-123'},{pf_payment_id:''},{payment_status:'UNKNOWN'},{amount_gross:'0'},{signature:'bad'}])assert.equal(validNotification({...f,...edit},'123'),false)})

test('PayFast renewal date uses Johannesburg calendar date near midnight',()=>assert.equal(nextBillingDate('2026-10-24T23:00:00Z'),'2026-11-25'))
