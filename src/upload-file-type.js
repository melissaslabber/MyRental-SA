const supported=new Set(['application/pdf','image/jpeg','image/png','image/webp'])
export function uploadFileType(file){
 if(supported.has(file.type))return file.type
 if(file.type&&file.type!=='application/octet-stream')return null
 return {pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[file.name?.split('.').pop()?.toLowerCase()]||null
}
