import test from 'node:test'
import assert from 'node:assert/strict'
import {leaseExpiryAlerts} from '../src/lease-alerts.js'
const property={id:'p',name:'Test home',leases:[{id:'l',status:'active',tenant_name:'Test tenant',end_date:'2027-01-12'}]}
test('alerts start exactly 80 calendar days before expiry and persist after expiry',()=>{
  assert.equal(leaseExpiryAlerts([property],new Date('2026-10-23T10:00:00Z')).length,0)
  assert.equal(leaseExpiryAlerts([property],new Date('2026-10-24T10:00:00Z'))[0].daysLeft,80)
  assert.equal(leaseExpiryAlerts([property],new Date('2027-01-13T10:00:00Z'))[0].daysLeft,-1)
})
test('uses South African date at midnight, ignores inactive and invalid leases, resolves on renewal',()=>{
  assert.equal(leaseExpiryAlerts([property],new Date('2026-10-23T22:01:00Z'))[0].daysLeft,80)
  for(const lease of [{status:'ended',end_date:'2027-01-12'},{status:'active',end_date:'2027-02-30'},{status:'active',end_date:'2028-01-12'}]) assert.equal(leaseExpiryAlerts([{...property,leases:[lease]}],new Date('2026-10-24T10:00:00Z')).length,0)
})
