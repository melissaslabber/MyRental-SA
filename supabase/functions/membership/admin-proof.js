import crypto from 'node:crypto'
import {Buffer} from 'node:buffer'
export function issueAdminProof(userId,key,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({userId,expires:now+15*60000,scope:'admin',nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url')
 return {proof:payload+'.'+crypto.createHmac('sha256',key).update(payload).digest('base64url'),expiresAt:now+15*60000}
}
export function validAdminProof(proof,userId,key,now=Date.now()){
 try{if(typeof proof!=='string'||proof.length>2000)return false;const [payload,signature,...rest]=proof.split('.');if(rest.length||!payload||!signature)return false;const actual=Buffer.from(signature,'base64url'),expected=crypto.createHmac('sha256',key).update(payload).digest();if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return false;const claims=JSON.parse(Buffer.from(payload,'base64url').toString());return claims.scope==='admin'&&claims.userId===userId&&Number.isFinite(claims.expires)&&claims.expires>now&&claims.expires<=now+15*60000}catch{return false}
}
