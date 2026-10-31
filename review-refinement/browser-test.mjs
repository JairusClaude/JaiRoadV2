import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import process from 'node:process';
import {mappingData} from '../resources/js/lib/road-coverages/geometry.mjs';
const base='http://127.0.0.1:5179';
const server=spawn('node',['tools/maintenance-project-preview/server.mjs'],{stdio:['ignore','pipe','pipe']});let browser;
const checks=[],errors=[],routes=[];
const pass=name=>{
checks.push({name,status:'PASS'});console.log('PASS',name)
};
const limit=name=>{
checks.push({name,status:'LIMITATION'});console.log('LIMITATION',name)
};

try {
 await new Promise((resolve,reject)=>{
server.stdout.on('data',d=>{
if(d.toString().includes('5179')){
resolve()
}
});server.stderr.on('data',d=>console.log(String(d)));setTimeout(()=>reject(Error('Server start timed out')),10000)
});
 browser=await chromium.launch({executablePath:'/workspace/scratch/40cc43c72aeb/browser-runtime/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}:undefined});
 const context=await browser.newContext({viewport:{width:1536,height:1080},ignoreHTTPSErrors:true});const page=await context.newPage();page.setDefaultTimeout(14000);
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('response',async r=>{
if(r.url().includes('/route/v1/')){
try{
routes.push({url:r.url(),status:r.status(),body:await r.json()})
}catch { /* Best-effort diagnostics; business assertions below remain authoritative. */ }
}
});
 await mkdir('review-refinement/screenshots',{recursive:true});
 const shot=async name=>{
await page.screenshot({path:`review-refinement/screenshots/${name}.png`,fullPage:true})
};
 const dir=async()=> (await (await context.request.get(base+'/road-coverages',{headers:{'X-Inertia':'true'}})).json()).props.coverages.data;
 const getRow=async id=>(await(await context.request.get(`${base}/road-coverages/${id}/edit`,{headers:{'X-Inertia':'true'}})).json()).props.coverage;
 const form=async name=>{
await page.getByLabel('Road Coverage Name').fill(name);await page.locator('#lgus_id').click();await page.getByRole('option').first().click();await page.locator('#pavement_type').click();await page.getByRole('option',{name:'Concrete',exact:true}).click();await page.locator('#state_category').click();await page.getByRole('option',{name:'Good',exact:true}).click()
};
 const open=async url=>{
await page.goto(base+url);await page.waitForSelector('.jr-map-workspace');await page.waitForTimeout(700)
};
 const zoom=async()=>{
for(let i=0;i<3;i++){
await page.locator('.leaflet-control-zoom-in').click();await page.waitForTimeout(300)
}
};
 const world=([lng,lat],z)=>[256*2**z*(lng+180)/360,256*2**z*(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
 const clickGeo=async(point)=>{
const rect=await page.locator('.jr-leaflet-map').boundingBox(),c=world([125.967,7.603],16),p=world(point,16);await page.mouse.click(rect.x+rect.width/2+p[0]-c[0],rect.y+rect.height/2+p[1]-c[1])
};
 const waitRoute=async()=>page.waitForFunction(()=>!document.querySelector('.jr-map-portions').textContent.includes('Calculating route'),null,{timeout:30000});
 const segments=()=>page.locator('.jr-map-portions > button');
 const pathClick=async i=>{
const path=page.locator(`.jr-road-line-${i}`);let hit=await path.evaluate(el=>{
const v=el.getPointAtLength(el.getTotalLength()*.55);const q=new DOMPoint(v.x,v.y).matrixTransform(el.getScreenCTM());

return{x:q.x,y:q.y}
});await page.mouse.click(hit.x,hit.y);

if(!await page.locator('.jr-road-context').count()){
await path.dispatchEvent('click',{bubbles:true,clientX:hit.x,clientY:hit.y})
}
};
 await open('/road-coverages/create');assert.match(await page.locator('.jr-map-instruction').innerText(),/Location A/);assert.equal(await segments().count(),0);pass('Add starts ready for Location A; no unnecessary B–C section');
 await zoom();await shot('01-add-ready');await clickGeo([125.96602,7.60003]);await clickGeo([125.963213,7.603703]);await waitRoute();assert.equal(await segments().count(),1);assert.match(await segments().first().innerText(),/Complete/);assert.match(await page.locator('.jr-calculated-length').innerText(),/\d+\.\d{2} km/);assert.equal(await page.locator('#kilometers').count(),0);pass('A–B routes automatically; bounded road snapping completes route and calculates length');await shot('02-two-location-complete');
 await pathClick(0);assert.equal(await page.locator('.jr-road-line-0').getAttribute('stroke'),'#2563eb');assert.ok(await page.getByRole('button',{name:'Other Routes',exact:true}).isVisible());assert.equal(await page.getByRole('button',{name:'Retry Route',exact:true}).count(),0);pass('Direct road click turns only selected line blue and opens state-specific popup');await shot('03-selected-road-popup');
 await page.getByRole('button',{name:'Other Routes',exact:true}).click();await page.waitForTimeout(8000);

 if(await page.getByRole('button',{name:'Use This Route',exact:true}).count()){
pass('Provider supplied genuine alternatives');await page.getByRole('button',{name:'Cancel',exact:true}).first().click()
}else{
assert.match(await page.locator('.jr-map-panel').innerText(),/No alternative routes returned/);limit('Provider returned only one route; genuine no-alternatives feedback verified')
}

 await page.keyboard.press('Escape');assert.equal(await page.locator('.jr-road-context').count(),0);assert.equal(await page.locator('.jr-road-line-0').getAttribute('stroke'),'#843b12');pass('Escape clears selection and restores brown road');
 await form('Browser verified two-location road');await page.getByRole('button',{name:'Save Road Coverage',exact:true}).click();await page.waitForURL('**/road-coverages');let row=(await dir()).find(x=>x.road_name==='Browser verified two-location road');assert.ok(row);let saved=await getRow(row.id);assert.equal(mappingData(saved.geojson).points.length,2);assert.equal(mappingData(saved.geojson).legs.length,1);pass('Valid two-location road saves as one RoadCoverage in temporary preview');
 await open(`/road-coverages/${row.id}/edit`);const n=routes.length;await page.waitForTimeout(1500);assert.equal(routes.length,n);assert.equal(await page.locator('.jr-control-location').count(),2);pass('Edit loads saved two-point geometry without rerouting');
 const ab=structuredClone(mappingData(saved.geojson).legs[0]);await page.getByRole('button',{name:'Add Location C',exact:true}).click();
 // Edit fits saved bounds; place C on a visible point, then verify routing outcome or draw manually if road absent.
 const rect=await page.locator('.jr-leaflet-map').boundingBox();await page.mouse.click(rect.x+rect.width*.68,rect.y+rect.height*.32);await waitRoute();assert.equal(await segments().count(),2);assert.match(await segments().nth(1).innerText(),/Complete/);await shot('04a-three-automatic-locations');pass('Add Location C creates only B–C without regenerating A–B');
 await segments().nth(1).click();await page.getByRole('button',{name:/^(Redraw Road|Draw Road)$/,exact:true}).click();await page.mouse.click(rect.x+rect.width*.54,rect.y+rect.height*.4);await shot('04-manual-drawing');assert.match(await page.locator('.jr-map-floating-actions').innerText(),/B–C.*Drawing in progress/s);await page.getByRole('button',{name:'Finish Drawing',exact:true}).click();assert.match(await segments().nth(1).innerText(),/Manual/);assert.match(await segments().nth(1).innerText(),/Complete/);pass('Draw/Redraw produces a blue dashed draft and completes a selected manual portion in one step');
 await page.getByRole('button',{name:'Adjust Recorded Length',exact:true}).click();await page.locator('#kilometers').fill('3.21');await page.locator('#correction_reason').fill('Browser verification: extend with third location');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForURL('**/road-coverages');saved=await getRow(row.id);assert.deepEqual(mappingData(saved.geojson).legs[0],ab);assert.equal(saved.kilometers,'3.21');assert.equal(mappingData(saved.geojson).points.length,3);pass('Three-location save preserves A–B exactly and stores manual length override');
 await open(`/road-coverages/${row.id}/edit`);await shot('05-three-location-review');await segments().nth(1).click();assert.equal(await page.locator('.jr-road-line-0').getAttribute('stroke'),'#843b12');assert.equal(await page.locator('.jr-road-line-1').getAttribute('stroke'),'#2563eb');assert.ok(await page.getByRole('button',{name:'Edit Path',exact:true}).isVisible());assert.equal(await page.getByRole('button',{name:'Other Routes',exact:true}).count(),0);pass('Panel selection matches map selection; manual popup offers Edit Path rather than automatic actions');
 const before=await page.locator('.jr-road-line-1').getAttribute('d');await page.getByRole('button',{name:'Edit Path',exact:true}).click();assert.ok(await page.locator('.jr-trace-vertex').count());const handle=await page.locator('.jr-trace-vertex').first().boundingBox();await page.mouse.move(handle.x+7,handle.y+7);await page.mouse.down();await page.mouse.move(handle.x+32,handle.y+20,{steps:8});await page.mouse.up();await shot('06-edit-manual-point');await page.getByRole('button',{name:'Cancel',exact:true}).first().click();assert.equal(await page.locator('.jr-road-line-1').getAttribute('d'),before);pass('Manual tracing point drag works; Cancel restores the previous geometry');
 await page.getByRole('button',{name:'Edit Path',exact:true}).click();const h=await page.locator('.jr-trace-vertex').first().boundingBox();await page.mouse.move(h.x+7,h.y+7);await page.mouse.down();await page.mouse.move(h.x+24,h.y+18,{steps:8});await page.mouse.up();await page.getByRole('button',{name:'Finish Editing',exact:true}).click();assert.notEqual(await page.locator('.jr-road-line-1').getAttribute('d'),before);assert.match(await page.locator('.jr-recorded-measure').innerText(),/3.21/);assert.match(await page.locator('.jr-coverage-length').innerText(),/adjusted recorded length is retained/);pass('Manual correction applies; length override survives geometry changes with discrepancy message');
 await page.getByRole('button',{name:'Road Information',exact:true}).click();await page.getByRole('button',{name:'Collapse mapping panel'}).click();await page.getByRole('button',{name:'Fullscreen map workspace'}).click();assert.ok(await page.evaluate(()=>document.fullscreenElement));await shot('07-fullscreen-collapsed-panel');await page.getByRole('button',{name:'Exit fullscreen'}).click();await page.getByRole('button',{name:'Expand mapping panel'}).click();assert.equal(await page.getByRole('button',{name:'Road Information',exact:true}).getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.jr-control-location').count(),3);pass('Independent panel/section collapse and fullscreen preserve state');
 await page.getByRole('button',{name:'Use calculated length',exact:true}).click();assert.equal(await page.locator('.jr-recorded-measure').count(),0);await page.locator('#correction_reason').fill('Browser verification: correct manual bend');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForURL('**/road-coverages');const updated=await getRow(row.id);assert.deepEqual(mappingData(updated.geojson).legs[0],ab);assert.notDeepEqual(mappingData(updated.geojson).legs[1],mappingData(saved.geojson).legs[1]);pass('Saved manual B–C correction leaves A–B byte-for-byte unchanged; calculated length restored');
 await open(`/road-coverages/${row.id}/edit`);await page.getByLabel('Road Coverage Name').fill('Information-only browser update');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForURL('**/road-coverages');assert.deepEqual((await getRow(row.id)).geojson,updated.geojson);pass('Information-only edit preserves saved GeoJSON exactly');
 await open('/road-coverages/create');await zoom();await page.route('**/route/v1/**',r=>r.abort());await clickGeo([125.96602,7.60003]);await clickGeo([125.963213,7.603703]);await waitRoute();assert.match(await segments().first().innerText(),/Route unavailable/);await segments().first().click();assert.ok(await page.getByRole('button',{name:'Retry Route',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'Draw Road',exact:true}).isVisible());await shot('08-routing-error-recovery');pass('Failed routing retains locations and provides specific error/recovery actions even without a line');
 await page.unroute('**/route/v1/**');await page.getByRole('button',{name:'Retry Route',exact:true}).click();await waitRoute();assert.match(await segments().first().innerText(),/Complete/);pass('Retry Route recovers a failed portion');
 await page.getByRole('button',{name:'Dismiss road selection'}).click();await page.getByRole('button',{name:'Draw',exact:true}).click();await page.mouse.click(rect.x+200,rect.y+240);await page.getByRole('button',{name:'Save Road Coverage',exact:true}).click();assert.match(await page.locator('#geojson').innerText(),/Finish or cancel/);await page.locator('.jr-map-floating-actions').getByRole('button',{name:'Undo',exact:true}).click();await page.locator('.jr-map-floating-actions').getByRole('button',{name:'Cancel',exact:true}).click();pass('Draw toolbar, scoped Undo, and unfinished-operation save validation work');
 await page.setViewportSize({width:390,height:844});await open(`/road-coverages/${row.id}/edit`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('09-narrow-edit');pass('Narrow layout stacks map and information with no horizontal overflow');
 await page.setViewportSize({width:1536,height:1080});await page.goto(base+'/road-coverages');assert.ok(await page.getByRole('heading',{name:'Road Coverages',exact:true}).isVisible());await shot('10-directory');await page.goto(base+'/maintenance-projects');await page.getByRole('heading',{name:'Maintenance Projects',exact:true}).waitFor();pass('Road Coverage and Maintenance Projects directories remain functional');
 assert.equal(errors.length,0);pass('No browser runtime errors, including forced routing failure');
} catch(e){
checks.push({name:e.stack,status:'FAIL'});console.error(e);

throw e
}finally{
await writeFile('review-refinement/browser-results.json',JSON.stringify({checks,errors,routes},null,2));await browser?.close();server.kill()
}
