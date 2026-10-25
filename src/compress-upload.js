// Keep PDFs byte-for-byte: rewriting them can invalidate digital signatures.
export function imageUploadSize(width,height){const scale=Math.min(1,2400/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))}}
async function encodeImage(file,mime){
 const bitmap=await createImageBitmap(new Blob([file],{type:mime}));
 try{
  const size=imageUploadSize(bitmap.width,bitmap.height),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');if(!ctx)return null;ctx.drawImage(bitmap,0,0,size.width,size.height);
  return await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.88))
 }finally{bitmap.close()}
}
export async function compressUpload(file,mime,encode=encodeImage){
 if(!mime?.startsWith('image/')||file.size<256*1024)return {file,mime,savedBytes:0};
 try{
  const blob=await encode(file,mime);
  if(!blob||blob.type!=='image/webp'||blob.size<=0||blob.size>=file.size*0.9)return {file,mime,savedBytes:0};
  const compressed=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:blob.type,lastModified:file.lastModified});
  return {file:compressed,mime:blob.type,savedBytes:file.size-compressed.size}
 }catch{return {file,mime,savedBytes:0}}
}
