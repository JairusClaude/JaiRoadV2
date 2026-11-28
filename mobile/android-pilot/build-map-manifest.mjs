// Usage: node mobile/android-pilot/build-map-manifest.mjs ID VERSION LABEL ATTRIBUTION png
// Place LICENSED XYZ tiles in public/offline-maps/ID/VERSION/z/x/y.ext before running.
// Do not use tiles from tile.openstreetmap.org; its public service prohibits offline use.
import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const [id,version,label,attribution,format]=process.argv.slice(2);
if(!/^[a-zA-Z0-9_-]{1,40}$/.test(id??'')||!/^[a-zA-Z0-9_-]{1,40}$/.test(version??'')||!label||label.length>60||!attribution||attribution.length>200||!['png','jpg','webp'].includes(format))throw new Error('Supply valid pack ID, version, label, licensed attribution and format.');
const base=resolve('public/offline-maps'),dir=resolve(base,id,version),tiles=[];
let total=0;
for(const file of await readdir(dir,{recursive:true,withFileTypes:true})){
    if(!file.isFile())continue;
    const path=resolve(file.parentPath,file.name),match=relative(dir,path).match(new RegExp('^(\\d+)/(\\d+)/(\\d+)\\.'+format+'$'));
    if(!match)throw new Error('Invalid XYZ tile path '+relative(dir,path));
    const [z,x,y]=match.slice(1).map(Number);
    if(z<0||z>19||x>=2**z||y>=2**z)throw new Error('Invalid coordinates.');
    const bytes=await readFile(path);if(!bytes.length||bytes.length>1024*1024)throw new Error('Invalid tile size.');
    total+=bytes.length;tiles.push({z,x,y,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
if(!tiles.length||tiles.length>60000||total>512*1024*1024)throw new Error('Pack empty or exceeds configured bounds.');
const old=JSON.parse(await readFile(resolve(base,'manifest.json'),'utf8'));
const packs=old.packs.filter(p=>p.id!==id);
packs.push({id,version,label,attribution,format,minZoom:Math.min(...tiles.map(t=>t.z)),maxZoom:Math.max(...tiles.map(t=>t.z)),tiles:tiles.sort((a,b)=>a.z-b.z||a.x-b.x||a.y-b.y)});
if(packs.length>2||packs.reduce((n,p)=>n+p.tiles.reduce((s,t)=>s+t.bytes,0),0)>512*1024*1024)throw new Error('Combined pack limit exceeded.');
await writeFile(resolve(base,'manifest.json'),JSON.stringify({packs},null,2)+'\n');
console.log('Verified manifest generated for '+tiles.length+' licensed tiles.');
