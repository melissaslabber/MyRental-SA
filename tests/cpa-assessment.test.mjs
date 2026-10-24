import test from 'node:test'
import assert from 'node:assert/strict'
import {assessLease,emptyAssessment} from '../src/cpa-assessment.js'
const base={ordinary:'yes',landlord:'natural',tenant:'natural',term:'fixed',special:'no'}
test('CPA assessment does not default incomplete or uncertain answers to non-CPA',()=>{
 assert.equal(assessLease(emptyAssessment).kind,'review')
 for(const key of Object.keys(base))assert.equal(assessLease({...base,[key]:'unsure'}).kind,'review')
 assert.equal(assessLease({...base,special:'yes'}).kind,'review')
})
test('CPA assessment separates general coverage from section 14',()=>{
 assert.equal(assessLease(base).kind,'cpa')
 assert.equal(assessLease({...base,ordinary:'no'}).kind,'non-cpa')
 assert.equal(assessLease({...base,tenant:'state'}).kind,'non-cpa')
 assert.equal(assessLease({...base,tenant:'juristic'}).kind,'review')
 assert.equal(assessLease({...base,tenant:'juristic',threshold:'above'}).kind,'non-cpa')
 assert.equal(assessLease({...base,tenant:'juristic',threshold:'below'}).kind,'cpa')
 assert.equal(assessLease({...base,landlord:'juristic',tenant:'juristic',threshold:'below'}).kind,'mixed')
 assert.equal(assessLease({...base,term:'monthly'}).kind,'mixed')
})
