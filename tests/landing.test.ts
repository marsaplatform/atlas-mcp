import { afterAll, beforeAll, expect, test } from "bun:test";
import { AtlasService } from "../src/application/atlas-service";
import { DemoRepository } from "../src/infrastructure/demo-repository";
import { startHttpServer } from "../src/interfaces/http";
import { renderResults } from "../src/interfaces/landing";
import type { AnyAtlasRecord } from "../src/domain/models";
let server: ReturnType<typeof Bun.serve>;let base:string;
beforeAll(()=>{server=startHttpServer(new AtlasService(new DemoRepository()),0);base=`http://127.0.0.1:${server.port}`;});
afterAll(()=>server.stop(true));
test("Arabic and English landing routes expose a working progressive search form",async()=>{
 for(const [path,lang,dir] of [["/","ar","rtl"],["/en","en","ltr"]]){
  const r=await fetch(base+path);const body=await r.text();expect(r.status).toBe(200);expect(body).toContain(`lang="${lang}" dir="${dir}"`);expect(body).toContain('id="atlas-search" method="get"');expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
 }
});
test("server search renders sources and verification dates without JavaScript",async()=>{
 const body=await(await fetch(base+'/?q='+encodeURIComponent('تعليم'))).text();expect(body).toContain('class="result"');expect(body).toContain('آخر تحقق مسجل');
});
test("untrusted record text and non-web source links cannot inject markup",()=>{
 const item={id:'test',type:'source',title:'<img src=x onerror=alert(1)>',summary:'<script>bad()</script>',countryCode:'EG',language:'ar',source:{name:'source',url:'javascript:alert(1)',publisher:'test',retrievedAt:'2026-10-20'},lastVerified:'',recordStatus:'demo',coverageNotes:[],tags:[]} as AnyAtlasRecord;
 const html=renderResults([item],'ar');expect(html).not.toContain('<img');expect(html).not.toContain('<script');expect(html).not.toContain('href="javascript:');expect(html).toContain('&lt;script&gt;');expect(html).toContain('سجل توضيحي');
});
test("browser assets are served and private filesystem paths are not",async()=>{
 expect((await fetch(base+'/assets/atlas.js')).status).toBe(200);expect((await fetch(base+'/assets/atlas.css')).status).toBe(200);expect((await fetch(base+'/assets/fonts/Zad-Regular.woff2')).status).toBe(200);expect((await fetch(base+'/assets/../../package.json')).status).toBe(404);
});
