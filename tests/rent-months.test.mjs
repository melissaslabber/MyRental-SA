import test from 'node:test'
import assert from 'node:assert/strict'
import {rentalMonths,rentPosition} from '../src/rent-months.js'
test('upcoming rent months cross year-end and partial rent stays outstanding independently of services',()=>{
 assert.deepEqual(rentalMonths('2026-11',3),['2026-11-01','2026-12-01','2027-01-01'])
 assert.deepEqual(rentPosition({rental_invoice_lines:[{kind:'rent',amount:10000},{kind:'service',amount:500}],rental_invoice_payments:[{amount:4500,rent_component:4000}]}),{due:10000,received:4000,balance:6000})
})
