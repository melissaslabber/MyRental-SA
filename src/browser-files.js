// Keep downloads independent of Web Share permissions and transient activation.
export function downloadFile(file){
 const url=URL.createObjectURL(file),link=document.createElement('a')
 link.href=url;link.download=file.name;link.style.display='none';document.body.appendChild(link)
 try{link.click()}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
export async function deliverBrowserFile(file,{mode='download',nav=globalThis.navigator,download=downloadFile}={}){
 if(mode==='share'){
  try{if(nav?.share&&(!nav.canShare||nav.canShare({files:[file]}))){await nav.share({files:[file],title:file.name});return 'shared'}}
  catch(error){if(error?.name==='AbortError')return 'cancelled'}
 }
 download(file);return 'downloaded'
}
