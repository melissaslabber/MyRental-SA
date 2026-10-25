import test from 'node:test'
import assert from 'node:assert/strict'
import {deliverBrowserFile} from '../src/browser-files.js'
const file={name:'invoice.pdf'}
test('PDF download never requests sharing permissions',async()=>{
 let downloads=0;assert.equal(await deliverBrowserFile(file,{nav:{share:()=>{throw Error('Should not share')}},download:f=>{assert.equal(f,file);downloads++}}),'downloaded');assert.equal(downloads,1)
})
test('denied mobile sharing falls back to download',async()=>{
 let downloads=0;const nav={canShare:()=>true,share:async()=>{throw Object.assign(Error('Permission denied'),{name:'NotAllowedError'})}}
 assert.equal(await deliverBrowserFile(file,{mode:'share',nav,download:()=>downloads++}),'downloaded');assert.equal(downloads,1)
})
test('cancelling sharing stays cancelled, successful sharing does not also download',async()=>{
 let downloads=0;const options={mode:'share',download:()=>downloads++}
 assert.equal(await deliverBrowserFile(file,{...options,nav:{canShare:()=>true,share:async()=>{throw {name:'AbortError'}}}}),'cancelled')
 assert.equal(await deliverBrowserFile(file,{...options,nav:{canShare:()=>true,share:async()=>{}}}),'shared');assert.equal(downloads,0)
})
test('share attempts file sharing when the browser omits canShare and falls back if unsupported',async()=>{
 let shared=0,downloads=0
 assert.equal(await deliverBrowserFile(file,{mode:'share',nav:{share:async()=>shared++},download:()=>downloads++}),'shared')
 assert.equal(shared,1);assert.equal(downloads,0)
 assert.equal(await deliverBrowserFile(file,{mode:'share',nav:{share:async()=>{throw new TypeError('Unsupported files')}},download:()=>downloads++}),'downloaded')
 assert.equal(downloads,1)
})
