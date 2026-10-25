const supported=new Set(['application/pdf','image/jpeg','image/png','image/webp'])
export function uploadFileType(file){
 if(supported.has(file.type))return file.type
 if(['application/x-pdf','application/acrobat','applications/vnd.pdf','text/pdf','text/x-pdf'].includes(file.type?.toLowerCase()))return 'application/pdf'
 if(file.type&&file.type!=='application/octet-stream')return null
 return {pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[file.name?.split('.').pop()?.toLowerCase()]||null
}
