export async function inspectionPhotos(form,storage){
 const photos=[]
 for(const area of form.areas)for(const image of area.images||[]){
  const {data,error}=await storage.createSignedUrl(image.path,300)
  if(error||!data?.signedUrl)throw new Error(`Could not load a photograph for ${area.name}. Retry before downloading the complete report.`)
  const response=await fetch(data.signedUrl);if(!response.ok)throw new Error(`Could not download a photograph for ${area.name}. Please retry.`)
  let blob=await response.blob()
  if(!['image/png','image/jpeg'].includes(blob.type)){
   // Convert browser-supported gallery formats to an embeddable JPEG.
   const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0);bitmap.close();blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)throw new Error('Could not convert an inspection photograph. Use JPG or PNG.')
  }
  photos.push({...image,area:area.name,mime:blob.type,bytes:new Uint8Array(await blob.arrayBuffer())})
 }
 return photos
}
