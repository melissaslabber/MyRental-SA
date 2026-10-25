import test from 'node:test'
import assert from 'node:assert/strict'
import {uploadFileType} from '../src/upload-file-type.js'
test('phone file selections accept supported extensions when MIME is absent without accepting unsupported files',()=>{
 for(const type of ['application/x-pdf','application/acrobat','text/pdf'])assert.equal(uploadFileType({name:'report.pdf',type}),'application/pdf')
 assert.equal(uploadFileType({name:'LEASE.PDF',type:''}),'application/pdf')
 assert.equal(uploadFileType({name:'inspection.jpg',type:'application/octet-stream'}),'image/jpeg')
 assert.equal(uploadFileType({name:'photo',type:'image/png'}),'image/png')
 assert.equal(uploadFileType({name:'report.exe',type:''}),null)
 assert.equal(uploadFileType({name:'report.pdf',type:'text/html'}),null)
})
