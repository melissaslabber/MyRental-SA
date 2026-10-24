import * as PDFLib from 'pdf-lib'
import {rentalPdf} from '../shared/rental-documents'
import {deliverBrowserFile} from './browser-files'
import {isNative} from './native'
export async function shareRentalPdf(invoice,noticeText=null,mode='download'){const bytes=await rentalPdf(invoice,PDFLib,noticeText),name=(noticeText?'Breach-notice-':'Invoice-')+invoice.invoice_number+'.pdf'
 return savePdfFile(bytes,name,mode)
}
export async function savePdfFile(bytes,name,mode='download'){
 if(isNative()){const {Filesystem,Directory}=await import('@capacitor/filesystem');const {Share}=await import('@capacitor/share');let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const result=await Filesystem.writeFile({path:name,data:btoa(binary),directory:Directory.Cache});await Share.share({title:name,url:result.uri,dialogTitle:'Share rental document'});return}
 return deliverBrowserFile(new File([bytes],name,{type:'application/pdf'}),{mode})
}
export async function shareTenantText(invoice,text,channel){if(channel==='email'){window.location.href=`mailto:${encodeURIComponent(invoice.tenant_details?.email||'')}?subject=${encodeURIComponent('MyRental SA · '+invoice.invoice_number)}&body=${encodeURIComponent(text)}`;return}if(channel==='whatsapp'){window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');return}await navigator.clipboard.writeText(text)}
