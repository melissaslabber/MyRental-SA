import {Capacitor,registerPlugin} from '@capacitor/core'
export const isNative=()=>Capacitor.isNativePlatform()
const RentalPrint=registerPlugin('RentalPrint')
export async function openExternal(url){if(!/^https:\/\//.test(url))throw new Error('Secure links only');if(isNative()){const {Browser}=await import('@capacitor/browser');await Browser.open({url})}else window.open(url,'_blank','noopener,noreferrer')}
export async function saveTextFile(filename,text,mime='text/plain'){
 if(isNative()){const {Filesystem,Directory,Encoding}=await import('@capacitor/filesystem');const {Share}=await import('@capacitor/share');const result=await Filesystem.writeFile({path:filename,data:text,directory:Directory.Cache,encoding:Encoding.UTF8});await Share.share({title:filename,url:result.uri,dialogTitle:'Share your financial report'});return}
 const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([text],{type:mime}));link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)
}
export async function setupNative(){
 if(!isNative())return
 document.documentElement.classList.add('native-app')
 window.print=()=>{RentalPrint.print().catch(()=>alert('Could not open Android printing. Please try again.'))}
 const {App}=await import('@capacitor/app')
 await App.addListener('backButton',()=>{const close=document.querySelector('.editor-head > button,.sheet-head > button');if(close){close.click();return}const overview=document.querySelector('.sidebar nav button');if(overview&&document.title!=='Overview · MyRental SA'){overview.click();return}App.minimizeApp()})
}
