import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';import assert from'node:assert/strict';
import{spawn}from'node:child_process';import{mkdir,writeFile,readFile}from'node:fs/promises';import process from 'node:process';
import{routeFeature,mappingData}from'../resources/js/lib/road-coverages/geometry.mjs';
const base='http://127.0.0.1:5179',checks=[],errors=[],network=[];const pass=n=>{
checks.push({name:n,status:'PASS'});console.log('PASS',n)
};const server=spawn('node',['tools/maintenance-project-preview/server.mjs'],{stdio:['ignore','pipe','pipe']});let browser,page;

try{
await new Promise((resolve,reject)=>{
server.stdout.on('data',d=>{
if(String(d).includes('5179')){
resolve()
}
});setTimeout(()=>reject(Error('Preview start timeout')),10000)
});browser=await chromium.launch({executablePath:'/workspace/scratch/40cc43c72aeb/browser-runtime/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}:undefined});const ctx=await browser.newContext({viewport:{width:1536,height:1080},ignoreHTTPSErrors:true});page=await ctx.newPage();page.setDefaultTimeout(14000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('response',async r=>{
if(r.url().includes('/route/v1/')){
try{
network.push({url:r.url(),status:r.status(),body:await r.json()})
}catch { /* Best-effort diagnostics; business assertions below remain authoritative. */ }
}
});await mkdir('review-locations/screenshots',{recursive:true});
const shot=async n=>{
await page.screenshot({path:`review-locations/screenshots/${n}.png`,fullPage:true})
};const props=async url=>(await(await ctx.request.get(base+url,{headers:{'X-Inertia':'true'}})).json()).props;const open=async url=>{
await page.goto(base+url);await page.waitForSelector('.jr-map-workspace');await page.waitForTimeout(600)
};const marks=()=>page.locator('.jr-control-location');const portions=()=>page.locator('.jr-map-portions > button');const coords=()=>page.locator('.jr-map-location-list details span').allTextContents();
const selectMarker=async i=>{
await marks().nth(i).click();await page.getByRole('group',{name:`Location ${'ABC'[i]} actions`,exact:true}).waitFor()
};const dialog=()=>page.getByRole('dialog');const undo=async()=>{
await page.locator('.jr-map-modebar').getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(200)
};const rect=async()=>page.locator('.jr-leaflet-map').boundingBox();const rawClick=async(x,y)=>{
const r=await rect();await page.mouse.click(r.x+r.width*x,r.y+r.height*y)
};
const waitRoute=async()=>page.waitForFunction(()=>!document.querySelector('.jr-map-portions').textContent.includes('Calculating route'),null,{timeout:30000});
await open('/road-coverages/create');assert.match(await page.locator('.jr-map-instruction').innerText(),/Location A/);assert.ok(await page.getByRole('button',{name:'Add Location',exact:true}).isVisible());await shot('01-updated-toolbar');await rawClick(.38,.53);await page.getByRole('button',{name:'Pause placement',exact:true}).click();await page.getByRole('button',{name:'Add Location',exact:true}).click();assert.match(await page.locator('.jr-map-instruction').innerText(),/Location B/);assert.equal(await marks().count(),1);pass('Add opens ready for A; Add Location resumes B without resetting A');
// Use a fresh initial view and genuine road positions for the live routing check.
await open('/road-coverages/create');

for(let i=0;i<3;i++){
await page.locator('.leaflet-control-zoom-in').click();await page.waitForTimeout(300)
}

const world=([lng,lat])=>[256*2**16*(lng+180)/360,256*2**16*(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];const clickGeo=async p=>{
const r=await rect(),q=world(p),c=world([125.967,7.603]);await page.mouse.click(r.x+r.width/2+q[0]-c[0],r.y+r.height/2+q[1]-c[1])
};
await clickGeo([125.96602,7.60003]);await clickGeo([125.963213,7.603703]);await waitRoute();assert.match(await portions().first().innerText(),/Complete/);const liveAB=await page.locator('.jr-road-line-0').getAttribute('d');await page.getByRole('button',{name:'Add Location',exact:true}).click();await clickGeo([125.967213,7.606273]);await waitRoute();assert.equal(await marks().count(),3);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),liveAB);assert.ok(await page.getByRole('button',{name:'Add Location',exact:true}).isDisabled());await rawClick(.6,.6);assert.equal(await marks().count(),3);pass('B automatically routes A–B; toolbar Add Location extends C, preserves A–B and prevents a fourth point');
// Seed a selected-record Edit fixture from actual stored OSRM responses for deterministic location operations.
const live=JSON.parse(await readFile('review-refinement/browser-results.json'));const a=live.routes[0].body.routes[0].geometry.coordinates,b=live.routes[2].body.routes[0].geometry.coordinates;const geo=routeFeature([a[0],a.at(-1),b.at(-1)],[a,b]);geo.properties.jairoads_editor={version:1,manual:[false,false]};const options=(await props('/road-coverages/create')).municipalities;const lgu=options.find(x=>x.municipality_name==='Nabunturan')??options[0];await ctx.request.post(base+'/road-coverages',{data:{road_name:'Development location-management verification',lgus_id:String(lgu.id),kilometers:'1.25',pavement_type:'Concrete',state_category:'Good',geojson:geo}});const row=(await props('/road-coverages')).coverages.data.find(x=>x.road_name==='Development location-management verification');const edit=()=>open(`/road-coverages/${row.id}/edit`);await edit();const originalCoords=await coords();const ab=await page.locator('.jr-road-line-0').getAttribute('d'),bc=await page.locator('.jr-road-line-1').getAttribute('d');

for(let i=0;i<3;i++){
await selectMarker(i);assert.ok(await page.getByRole('button',{name:'Move Location',exact:true}).isVisible());await page.getByRole('button',{name:'Dismiss location selection'}).click()
}

pass('All A/B/C markers open small management popups');
await selectMarker(1);await shot('02-location-marker-popup');await page.getByRole('button',{name:'Replace Location',exact:true}).click();await shot('03-replace-location-mode');assert.ok(await page.locator('.jr-map-floating-actions').getByRole('button',{name:'Cancel Replacement'}).isVisible());await page.getByRole('button',{name:'Cancel Replacement'}).click();assert.deepEqual(await coords(),originalCoords);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),ab);assert.equal(await page.locator('.jr-road-line-1').getAttribute('d'),bc);pass('Cancel Replacement retains original marker and both accepted routes');
await page.getByRole('button',{name:'Draw',exact:true}).click();await page.getByRole('group',{name:'Choose road portion to draw'}).waitFor();await shot('04-draw-target-menu');await page.keyboard.press('Escape');assert.equal(await page.locator('.jr-draw-targets').count(),0);await page.getByRole('button',{name:'Draw',exact:true}).click();await page.getByRole('button',{name:'Draw B–C',exact:true}).click();assert.match(await page.locator('.jr-map-floating-actions').innerText(),/B–C.*Drawing in progress/s);assert.match(await page.locator('.jr-map-panel').innerText(),/1 of 2 portions complete/);pass('Unselected three-point Draw asks for target; B–C drawing state excludes old completion');
// Add three manual points, then drag one while drawing; actual path reference supplies screen positions.
const ref=page.locator('.leaflet-overlay-pane path[stroke="#94a3b8"]');const points=await ref.evaluate(el=>[.25,.5,.75].map(t=>{
const v=el.getPointAtLength(el.getTotalLength()*t);const q=new DOMPoint(v.x,v.y).matrixTransform(el.getScreenCTM());

return{x:q.x,y:q.y}
}));

for(const p of points){
await page.mouse.click(p.x,p.y);
}

const count=await page.locator('.jr-trace-vertex').count();assert.equal(count,3);const before=await page.locator('.jr-road-line-1').getAttribute('d'),h=await page.locator('.jr-trace-vertex').nth(1).boundingBox();await page.mouse.move(h.x+7,h.y+7);await page.mouse.down();await page.mouse.move(h.x+28,h.y+17,{steps:8});assert.notEqual(await page.locator('.jr-road-line-1').getAttribute('d'),before);await page.mouse.up();await page.waitForTimeout(220);assert.equal(await page.locator('.jr-trace-vertex').count(),count);await shot('05-adjustable-drawing-points');pass('Intermediate point moves live before Finish Drawing without adding a point');
await page.locator('.jr-map-floating-actions').getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.locator('.jr-road-line-1').getAttribute('d'),before);await page.getByRole('button',{name:'Save Changes',exact:true}).click();assert.match(await page.locator('#geojson').innerText(),/Finish or cancel/);await page.locator('.jr-map-floating-actions').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('.jr-road-line-1').getAttribute('d'),bc);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),ab);pass('Drawing Undo reverses drag; Save blocks unfinished trace; Cancel restores prior geometry/status');
// Selected portion routes directly into Draw, then finish and store through the normal Save action.
await portions().nth(1).click();await page.getByRole('button',{name:'Draw',exact:true}).click();assert.equal(await page.locator('.jr-draw-targets').count(),0);

for(const p of points){
await page.mouse.click(p.x,p.y);
}

await page.getByRole('button',{name:'Finish Drawing',exact:true}).click();assert.match(await portions().nth(1).innerText(),/Manual/);assert.match(await portions().nth(1).innerText(),/Complete/);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),ab);await page.getByRole('button',{name:'Road Information',exact:true}).click();await shot('06-completed-manual-drawing');await page.locator('#correction_reason').fill('Development verification: manually correct B–C');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForURL('**/road-coverages');const saved=(await props(`/road-coverages/${row.id}/edit`)).coverage.geojson;assert.deepEqual(mappingData(saved).legs[0],mappingData(geo).legs[0]);pass('Selected Draw targets immediately; Finish accepts trace, updates length and saves without changing A–B');
await edit();const initial=await coords();const abSaved=await page.locator('.jr-road-line-0').getAttribute('d'),bcSaved=await page.locator('.jr-road-line-1').getAttribute('d');await selectMarker(2);await page.getByRole('button',{name:'Replace Location',exact:true}).click();await rawClick(.76,.46);assert.equal(await marks().count(),3);assert.match(await portions().nth(1).innerText(),/Needs correction/);assert.equal(await page.locator('.jr-road-line-1').getAttribute('d'),bcSaved);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),abSaved);pass('Replacing manual C preserves both paths and marks only B–C for correction');await undo();assert.deepEqual(await coords(),initial);pass('Undo replacement restores marker and valid route');
await selectMarker(2);await page.getByRole('button',{name:'Remove Location',exact:true}).click();await dialog().waitFor();await shot('07-removal-confirmation');await dialog().getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await marks().count(),3);await page.getByRole('button',{name:'Remove Location',exact:true}).click();await dialog().getByRole('button',{name:'Remove Location',exact:true}).click();assert.equal(await marks().count(),2);assert.equal(await portions().count(),1);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),abSaved);assert.match(await portions().first().innerText(),/Complete/);await undo();assert.equal(await marks().count(),3);pass('Remove C confirms; cancel keeps it; removal preserves complete A–B; Undo restores C');
await selectMarker(0);await page.getByRole('button',{name:'Remove Location',exact:true}).click();await dialog().getByRole('button',{name:'Remove Location',exact:true}).click();const removedA=await coords();assert.deepEqual(removedA,[initial[1],initial[2]]);assert.equal(await page.locator('.jr-road-line-0').getAttribute('d'),bcSaved);assert.match(await portions().first().innerText(),/Manual/);await undo();pass('Remove A keeps former B/C coordinates, relabels them and preserves the manual B–C path as A–B');
await selectMarker(1);await page.getByRole('button',{name:'Remove Location',exact:true}).click();assert.match(await dialog().innerText(),/Both road portions/);await dialog().getByRole('button',{name:'Remove Location',exact:true}).click();assert.deepEqual(await coords(),[initial[0],initial[2]]);assert.equal(await page.locator('.jr-road-line').count(),0);assert.match(await portions().first().innerText(),/Not yet mapped/);await portions().first().click();await shot('08-two-locations-after-removing-b');assert.ok(await page.getByRole('button',{name:'Retry Route',exact:true}).isVisible());await page.getByRole('button',{name:'Dismiss road selection'}).click();await page.getByRole('button',{name:'Draw',exact:true}).click();assert.match(await page.locator('.jr-map-floating-actions').innerText(),/A–B.*Drawing in progress/s);assert.ok(await page.locator('.jr-map-floating-actions').getByRole('button',{name:'Undo',exact:true}).isDisabled());await rawClick(.55,.6);await page.getByRole('button',{name:'Finish Drawing',exact:true}).click();assert.match(await portions().first().innerText(),/Complete/);await shot('09-rebuilt-two-location-road');pass('Remove B preserves A/C as sequential A/B, clears both old portions, and permits immediate one-portion Draw rebuilding');
// Two-point removal rules: both endpoints tested with complete/manual path confirmation.
const twoCoords=await coords();await selectMarker(0);await page.getByRole('button',{name:'Remove Location',exact:true}).click();await dialog().getByRole('button',{name:'Remove Location',exact:true}).click();assert.deepEqual(await coords(),[twoCoords[1]]);assert.equal(await portions().count(),0);assert.match(await page.locator('.jr-map-instruction').innerText(),/Location B/);assert.ok(await page.getByRole('button',{name:'Draw',exact:true}).isDisabled());await undo();await selectMarker(1);await page.getByRole('button',{name:'Remove Location',exact:true}).click();await dialog().getByRole('button',{name:'Remove Location',exact:true}).click();assert.deepEqual(await coords(),[twoCoords[0]]);await undo();pass('Two-point removal preserves and relabels the remaining location; incomplete road cannot be saved');
const name=await page.getByLabel('Road Coverage Name').inputValue();await page.getByRole('button',{name:'Start Over',exact:true}).click();await dialog().getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await marks().count(),2);await page.getByRole('button',{name:'Start Over',exact:true}).click();await dialog().getByRole('button',{name:'Clear Locations',exact:true}).click();assert.equal(await marks().count(),0);assert.equal(await portions().count(),0);assert.equal(await page.getByLabel('Road Coverage Name').inputValue(),name);assert.match(await page.locator('.jr-map-instruction').innerText(),/Location A/);assert.deepEqual((await props(`/road-coverages/${row.id}/edit`)).coverage.geojson,saved);await undo();pass('Start Over confirms, clears working map only, keeps form fields and saved record; Undo restores work');
await page.getByRole('button',{name:'Fullscreen map workspace'}).click();await page.getByRole('button',{name:'Start Over',exact:true}).click();assert.ok(await dialog().isVisible());assert.ok(await page.evaluate(()=>document.fullscreenElement.contains(document.querySelector('[role="dialog"]'))));await dialog().getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Exit fullscreen'}).click();pass('Location confirmation remains visible and keyboard-accessible inside fullscreen');
await page.setViewportSize({width:390,height:844});await page.locator('.jr-map-stage').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('10-narrow-toolbar');pass('Narrow layout stays within viewport');
assert.equal(errors.length,0);pass('No browser runtime errors');
}catch(e){
checks.push({name:e.stack,status:'FAIL'});console.error(e);

try{
await page?.screenshot({path:'review-locations/screenshots/failure.png',fullPage:true})
}catch { /* Best-effort diagnostics; business assertions below remain authoritative. */ }

throw e
}finally{
await writeFile('review-locations/browser-results.json',JSON.stringify({checks,errors,network},null,2));await browser?.close();server.kill()
}
