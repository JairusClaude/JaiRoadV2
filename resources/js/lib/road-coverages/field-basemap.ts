import L from 'leaflet';
import { androidWorkspace } from '@/lib/android-workspace-bridge';
import { DAVAO_DE_ORO_RING } from '@/components/maintenance-projects/davao-de-oro-boundary';

export function attachFieldBasemap(map:L.Map,tiles:L.TileLayer) {
    const bridge=androidWorkspace();if(!bridge)return;
    const boundary=L.polygon(DAVAO_DE_ORO_RING.map(([lng,lat])=>[lat,lng] as L.LatLngTuple),{color:'#94a3b8',weight:1,fillOpacity:0.08,interactive:false});
    const update=()=>{
        if(bridge.status().offline){
            if(map.hasLayer(tiles))map.removeLayer(tiles);
            if(!map.hasLayer(boundary)){boundary.addTo(map);boundary.bringToBack();}
        }else{
            if(map.hasLayer(boundary))map.removeLayer(boundary);
            if(!map.hasLayer(tiles))tiles.addTo(map);
        }
    };
    for(const event of ['jairoads-field-status','online','offline'])window.addEventListener(event,update);
    update();
    map.once('unload',()=>{for(const event of ['jairoads-field-status','online','offline'])window.removeEventListener(event,update);});
}
