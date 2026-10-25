import test from 'node:test'
import assert from 'node:assert/strict'
import {compressUpload,imageUploadSize} from '../src/compress-upload.js'
test('compression preserves PDFs and small files, only keeps meaningful savings and safely falls back',async()=>{
 const pdf=new File(['signed contents'],'signed.pdf',{type:'application/pdf'});
 assert.equal((await compressUpload(pdf,pdf.type,()=>{throw Error('must not rewrite PDF')})).file,pdf);
 const image=new File([new Uint8Array(400000)],'inspection.jpg',{type:'image/jpeg'});
 const good=await compressUpload(image,image.type,async()=>new Blob([new Uint8Array(100000)],{type:'image/webp'}));
 assert.equal(good.file.name,'inspection.webp');assert.equal(good.savedBytes,300000);assert.equal(good.mime,'image/webp');
 for(const encode of [async()=>null,async()=>{throw Error('decode failed')},async()=>new Blob([new Uint8Array(399999)],{type:'image/webp'})])assert.equal((await compressUpload(image,image.type,encode)).file,image);
 assert.deepEqual(imageUploadSize(4800,3200),{width:2400,height:1600});assert.deepEqual(imageUploadSize(600,900),{width:600,height:900});
})
