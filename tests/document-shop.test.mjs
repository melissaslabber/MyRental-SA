import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildShop,products,origin} from '../scripts/build-document-shop.mjs'
test('every product is crawlable HTML, linked in sitemap and honest about release status',async()=>{
 const out=await mkdtemp(join(tmpdir(),'myrental-shop-'))
 try{await buildShop(out);const sitemap=await readFile(join(out,'sitemap.xml'),'utf8');const catalogue=await readFile(join(out,'landlord-documents/index.html'),'utf8');const titles=new Set();for(const p of products){const url=`${origin}/landlord-documents/${p.slug}/`;const html=await readFile(join(out,'landlord-documents',p.slug,'index.html'),'utf8');assert.ok(sitemap.includes(`<loc>${url}</loc>`));assert.ok(catalogue.includes(`/landlord-documents/${p.slug}/`));assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.ok(html.includes(`<h1>${p.name}</h1>`));assert.ok(html.includes('Buy for R'));assert.ok(!html.includes('"@type":"Offer"'));assert.ok(!html.includes('onclick='));const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title));titles.add(title);const json=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);assert.equal(json.itemListElement[1].item,url)}
 }finally{await rm(out,{recursive:true,force:true})}
})
