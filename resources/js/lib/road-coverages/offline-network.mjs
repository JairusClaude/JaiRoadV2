// ODbL road-alignment suggestions, not navigation or road-condition guarantees.
const root='/jairoads-android-pilot/bundled-maps/';
const meters=(a,b)=>111195*Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),a[1]-b[1]);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const maxBytes=48*1024*1024;
let loaded;
export function buildNetwork(data) {
    if (!Array.isArray(data?.points)||data.points.length>650000||!data.points.every(point)||!Array.isArray(data.edges)||data.edges.length>1000000||!Array.isArray(data.places)||data.places.length>100000) throw new Error('Invalid offline road network');
    const neighbors=Array.from({length:data.points.length},()=>[]);
    for(const edge of data.edges){
        if(!Array.isArray(edge)||edge.length!==2||!edge.every(i=>Number.isInteger(i)&&i>=0&&i<data.points.length)||edge[0]===edge[1])throw new Error('Invalid offline road junction');
        const [a,b]=edge;
        const length=meters(data.points[a],data.points[b]);
        if(length>0){neighbors[a].push([b,length]);neighbors[b].push([a,length]);}
    }
    const places=data.places.filter(p=>typeof p?.name==='string'&&p.name.length<=160&&point(p.point));
    return {points:data.points,neighbors,places};
}
async function network() {
    loaded??=(async()=>{
        const manifest=await fetch(root+'manifest.json',{credentials:'omit',redirect:'error'});
        if(!manifest.ok)throw new Error('Offline road network not bundled');
        const {network:descriptor}=await manifest.json();
        if(!descriptor||!Number.isInteger(descriptor.bytes)||descriptor.bytes<1||descriptor.bytes>maxBytes||!/^[a-f0-9]{64}$/.test(descriptor.sha256))throw new Error('Invalid offline network manifest');
        const response=await fetch(root+'road-network.json',{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error('Offline road network unavailable');
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength!==descriptor.bytes)throw new Error('Incomplete offline road network');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(hash!==descriptor.sha256)throw new Error('Offline road network integrity check failed');
        return buildNetwork(JSON.parse(new TextDecoder().decode(bytes)));
    })().catch(error=>{loaded=undefined;throw error;});
    return loaded;
}
export function findPlaces(graph,query) {
    const text=query.trim().toLocaleLowerCase();
    if(text.length<2)return [];
    const seen=new Set();
    return graph.places.filter(p=>p.name.toLocaleLowerCase().includes(text)).sort((a,b)=>Number(!a.name.toLocaleLowerCase().startsWith(text))-Number(!b.name.toLocaleLowerCase().startsWith(text))||a.name.localeCompare(b.name)).filter(p=>{const key=p.name.toLocaleLowerCase()+':'+p.point.map(n=>n.toFixed(3)).join(',');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
}
function closest(graph,p){
    let best=-1,distance=50;
    for(let i=0;i<graph.points.length;i++){if(!graph.neighbors[i].length)continue;const d=meters(graph.points[i],p);if(d<distance){best=i;distance=d;}}
    return best;
}
class Heap {
    items=[];
    push(item){const a=this.items;let i=a.length;a.push(item);while(i>0){const p=(i-1)>>1;if(a[p][1]<=item[1])break;a[i]=a[p];i=p;}a[i]=item;}
    pop(){const a=this.items;if(!a.length)return undefined;const first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][1]<a[j][1])j++;if(a[j][1]>=last[1])break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}
export async function alignment(graph,a,b,signal){
    if(!point(a)||!point(b))return null;
    signal?.throwIfAborted();
    const start=closest(graph,a),end=closest(graph,b);
    if(start<0||end<0||start===end)return null;
    const n=graph.points.length,dist=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),closed=new Uint8Array(n);
    const heap=new Heap();
    dist[start]=0;heap.push([start,meters(graph.points[start],graph.points[end])]);
    let visited=0;
    const deadline=Date.now()+8000;
    while(heap.items.length){
        const [node]=heap.pop();
        if(closed[node])continue;
        closed[node]=1;
        if(node===end){
            const result=[];let id=end;
            while(id>=0&&result.length<=20000){result.push(graph.points[id]);if(id===start)return result.reverse();id=parent[id];}
            return null;
        }
        if(++visited%2048===0){signal?.throwIfAborted();if(Date.now()>deadline)return null;await new Promise(resolve=>setTimeout(resolve,0));}
        for(const [to,length] of graph.neighbors[node]){
            if(closed[to])continue;
            const next=dist[node]+length;
            if(next<dist[to]){dist[to]=next;parent[to]=node;heap.push([to,next+meters(graph.points[to],graph.points[end])]);}
        }
    }
    return null;
}
export async function offlinePlaceSearch(query){return findPlaces(await network(),query);}
export async function offlineAlignment(a,b,signal){return alignment(await network(),a,b,signal);}
