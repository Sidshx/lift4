import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
const root = "dist/public";
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push("./" + relative(root, p)); } })(root);
const list = ["./", ...files.filter((f) => f !== "./sw.js")];
const version = Date.now().toString(36);
writeFileSync(join(root, "sw.js"), `const CACHE="lift4-${version}";const FILES=${JSON.stringify(list)};
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET")return;const font=/fonts\.googleapis\.com|fonts\.gstatic\.com|fontshare\.com/.test(u.host);if(u.origin!==location.origin&&!font)return;
if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("./",c));return r}).catch(()=>caches.match("./")));return}
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return res})))});
`);
console.log("sw.js with", list.length, "files");
