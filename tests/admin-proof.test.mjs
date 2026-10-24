import test from 'node:test'
import assert from 'node:assert/strict'
import {issueAdminProof,validAdminProof} from '../supabase/functions/membership/admin-proof.js'
test('admin proof is owner-bound, expires and cannot be forged',()=>{
 const now=Date.now(),{proof}=issueAdminProof('owner','server-secret',now)
 assert.equal(validAdminProof(proof,'owner','server-secret',now),true)
 assert.equal(validAdminProof(proof,'other','server-secret',now),false)
 assert.equal(validAdminProof(proof,'owner','wrong-secret',now),false)
 assert.equal(validAdminProof(proof,'owner','server-secret',now+15*60000),false)
 const [payload,signature]=proof.split('.');const claims=JSON.parse(Buffer.from(payload,'base64url'));claims.userId='other';const forged=Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+signature
 assert.equal(validAdminProof(forged,'other','server-secret',now),false)
 assert.equal(validAdminProof('', 'owner','server-secret',now),false)
})
