import {supabase} from './supabase'
import {openExternal,isNative} from './native'
import {deliverBrowserFile} from './browser-files'
import {savePdfFile} from './rental-sharing'
const bucket='property-financial-documents'
export async function openPropertyFile(path,name,bucketName=bucket){
 if(!name){const {data,error}=await supabase.storage.from(bucketName).createSignedUrl(path,120);if(error||!data?.signedUrl)throw new Error('Could not open the private file. Refresh and try again.');await openExternal(data.signedUrl);return}
 const {data,error}=await supabase.storage.from(bucketName).download(path)
 if(error||!data)throw new Error('Could not download the private file. Refresh and try again.')
 if(isNative())return savePdfFile(new Uint8Array(await data.arrayBuffer()),name)
 return deliverBrowserFile(new File([data],name,{type:data.type||'application/octet-stream'}))
}

