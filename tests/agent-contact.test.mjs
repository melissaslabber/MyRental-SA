import test from 'node:test'
import assert from 'node:assert/strict'
import {contactFields,contactEmail} from '../supabase/functions/membership/agent-rules.js'
test('agent enquiries require explicit consent and complete landlord details',()=>{
 const input={consent:true,requestKey:'11111111-1111-4111-8111-111111111111',firstName:'Test',surname:'Landlord',email:'TEST@example.test',phone:'082 123 4567',address:'Example home',notes:'Please call'}
 const fields=contactFields(input);assert.equal(fields.email,'test@example.test');assert.throws(()=>contactFields({...input,consent:false}));assert.throws(()=>contactFields({...input,address:''}));assert.throws(()=>contactFields({...input,email:'bad'}))
 const mail=contactEmail({...fields,id:'request',consented_at:'2026-10-24'});assert.match(mail.text,/Name: Test/);assert.match(mail.text,/Surname: Landlord/);assert.match(mail.text,/082 123 4567/);assert.match(mail.text,/Example home/);assert.match(mail.text,/permission to share/)
})
