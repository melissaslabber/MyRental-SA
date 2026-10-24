import test from 'node:test'
import assert from 'node:assert/strict'
import {planForHomes,selectedPlan} from '../shared/pricing.js'
test('property subscription tiers match every boundary',()=>{for(const [homes,amount] of [[0,89],[1,89],[2,89],[3,299],[9,299],[10,599],[19,599],[20,1500],[100,1500]])assert.equal(planForHomes(homes).amount,amount);assert.throws(()=>planForHomes(-1));assert.throws(()=>selectedPlan(89,3));assert.throws(()=>selectedPlan(299,10));assert.equal(selectedPlan(599,3).amount,599)})
