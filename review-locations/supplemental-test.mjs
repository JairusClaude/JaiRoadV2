import{chromium}from'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';import assert from'node:assert/strict';
import{spawn}from'node:child_process';import{readFile,writeFile}from'node:fs/promises';import process from 'node:process';
import{routeFeature}from'../resources/js/lib/road-coverages/geometry.mjs';
const base='http://127.0.0.1:5179',checks=[],errors=[];const pass=n=>{
checks.push({name:n,status:'PASS'});console.log('PASS',n)
};const server=spawn('node',['tools/maintenance-project-preview/server.mjs'],{stdio:['ignore','pipe','pipe']});let browser,p;

try{
await new Promise(r=>server.stdout.on('data',d=>{
if(String(d).includes('5179')){
r()
}
}));browser=await chromium.launch({executablePath:'/workspace/scratch/40cc43c72aeb/browser-runtime/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}:undefined});const ctx=await browser.newContext({viewport:{width:1536,height:1080},ignoreHTTPSErrors:true});p=await ctx.newPage();p.setDefaultTimeout(12000);let allowDiscard=true,dialogs=0;p.on('dialog',d=>{
dialogs++;

return allowDiscard?d.accept():d.dismiss()
});p.on('pageerror',e=>errors.push(e.message));const props=async url=>(await(await ctx.request.get(base+url,{headers:{'X-Inertia':'true'}})).json()).props;
const live=JSON.parse(await readFile('review-refinement/browser-results.json'));const a=live.routes[0].body.routes[0].geometry.coordinates,b=live.routes[2].body.routes[0].geometry.coordinates;const geo=routeFeature([a[0],a.at(-1),b.at(-1)],[a,b]);geo.properties.jairoads_editor={version:1,manual:[false,false]};const municipalities=(await props('/road-coverages/create')).municipalities;const lgu=municipalities.find(x=>x.municipality_name==='Nabunturan')??municipalities[0];await ctx.request.post(base+'/road-coverages',{data:{road_name:'Supplemental location fixture',lgus_id:String(lgu.id),kilometers:'1.25',pavement_type:'Concrete',state_category:'Good',geojson:geo}});const row=(await props('/road-coverages')).coverages.data.find(x=>x.road_name==='Supplemental location fixture');const edit=async()=>{
await p.goto(base+`/road-coverages/${row.id}/edit`);await p.waitForSelector('.jr-map-workspace');await p.waitForTimeout(500)
};const coords=()=>p.locator('.jr-map-location-list details span').allTextContents();const paths=i=>p.locator(`.jr-road-line-${i}`);const pick=async i=>{
await p.locator('.jr-control-location').nth(i).click();await p.getByRole('button',{name:'Replace Location',exact:true}).click()
};const linePoint=async(i,t)=>paths(i).evaluate((el,t)=>{
const v=el.getPointAtLength(el.getTotalLength()*t);const q=new DOMPoint(v.x,v.y).matrixTransform(el.getScreenCTM());

return{x:q.x,y:q.y}
},t);const waitRoute=async()=>p.waitForFunction(()=>!document.querySelector('.jr-map-portions').textContent.includes('Calculating route'),null,{timeout:30000});
await edit();const before=await coords(),bc=await paths(1).getAttribute('d');const newA=await linePoint(0,.25);await pick(0);await p.mouse.click(newA.x,newA.y);await waitRoute();assert.notEqual((await coords())[0],before[0]);assert.deepEqual((await coords()).slice(1),before.slice(1));assert.equal(await paths(1).getAttribute('d'),bc);assert.match(await p.locator('.jr-map-portions button').first().innerText(),/Complete/);pass('Replace A recalculates only automatic A–B and preserves B/C plus B–C');
await edit();const beforeC=await coords(),ab=await paths(0).getAttribute('d'),newC=await linePoint(1,.7);await pick(2);await p.mouse.click(newC.x,newC.y);await waitRoute();assert.notEqual((await coords())[2],beforeC[2]);assert.deepEqual((await coords()).slice(0,2),beforeC.slice(0,2));assert.equal(await paths(0).getAttribute('d'),ab);pass('Replace automatic C recalculates B–C and keeps A–B unchanged');
await edit();await p.locator('.jr-map-portions button').nth(1).click();await p.getByRole('button',{name:'Redraw Road',exact:true}).click();const ref=p.locator('.leaflet-overlay-pane path[stroke="#94a3b8"]');const bend=await ref.evaluate(el=>{
const v=el.getPointAtLength(el.getTotalLength()*.5),q=new DOMPoint(v.x,v.y).matrixTransform(el.getScreenCTM());

return{x:q.x,y:q.y}
});await p.mouse.click(bend.x,bend.y);await p.getByRole('button',{name:'Finish Drawing',exact:true}).click();await p.keyboard.press('Escape');const beforeB=await coords(),manual=await paths(1).getAttribute('d'),newB=await linePoint(0,.65);await pick(1);await p.mouse.click(newB.x,newB.y);await waitRoute();const afterB=await coords();assert.notEqual(afterB[1],beforeB[1]);assert.equal(afterB[0],beforeB[0]);assert.equal(afterB[2],beforeB[2]);assert.equal(await paths(1).getAttribute('d'),manual);assert.match(await p.locator('.jr-map-portions button').nth(1).innerText(),/Needs correction/);assert.match(await p.locator('.jr-map-portions button').first().innerText(),/Complete/);pass('Replace B updates automatic A–B, retains manual B–C for correction and keeps outer coordinates');
await edit();await p.getByRole('button',{name:'Draw',exact:true}).click();assert.equal(await p.locator('.jr-draw-targets').count(),1);await p.getByRole('button',{name:'Road Information',exact:true}).click();assert.equal(await p.locator('.jr-draw-targets').count(),0);await p.getByRole('button',{name:'Draw',exact:true}).click();await p.getByRole('button',{name:'Draw A–B',exact:true}).click();assert.equal(await p.locator('.jr-trace-vertex').count(),0);const r=await p.locator('.jr-leaflet-map').boundingBox();await p.mouse.move(r.x+200,r.y+400);await p.mouse.down();await p.mouse.move(r.x+260,r.y+400,{steps:10});await p.mouse.up();assert.equal(await p.locator('.jr-trace-vertex').count(),0);await p.locator('.leaflet-control-zoom-out').click();assert.equal(await p.locator('.jr-trace-vertex').count(),0);await p.locator('.jr-map-floating-actions').getByRole('button',{name:'Cancel',exact:true}).click();pass('Draw chooser dismisses outside; panning and map controls do not add tracing points');
// A failed third portion is still selectable through the Draw target menu.
await edit();await p.locator('.jr-control-location').nth(2).click();await p.getByRole('button',{name:'Remove Location',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'Remove Location',exact:true}).click();await p.route('**/route/v1/**',route=>route.abort());await p.getByRole('button',{name:'Add Location',exact:true}).click();const failedMap=await p.locator('.jr-leaflet-map').boundingBox();await p.mouse.click(failedMap.x+failedMap.width*.7,failedMap.y+failedMap.height*.45);await waitRoute();assert.match(await p.locator('.jr-map-portions button').nth(1).innerText(),/Route unavailable/);await p.getByRole('button',{name:'Draw',exact:true}).click();await p.getByRole('button',{name:'Draw B–C',exact:true}).click();assert.match(await p.locator('.jr-map-floating-actions').innerText(),/B–C.*Drawing in progress/s);await p.locator('.jr-map-floating-actions').getByRole('button',{name:'Cancel',exact:true}).click();await p.unroute('**/route/v1/**');pass('Draw target chooser works when the third portion failed and has no line');
// Delay a genuine previously captured routing response, then invalidate its request by clearing.
await edit();let held,release;const gotRequest=new Promise(r=>held=r),ready=new Promise(r=>release=r);await p.route('**/route/v1/**',async route=>{
held();await ready;

try{
await route.fulfill({json:live.routes[0].body})
}catch { /* Best-effort diagnostics; business assertions below remain authoritative. */ }
});const endpoint=await linePoint(0,.35);await pick(0);await p.mouse.click(endpoint.x,endpoint.y);await gotRequest;await p.getByRole('button',{name:'Start Over',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:'Clear Locations',exact:true}).click();release();await p.waitForTimeout(500);assert.equal(await p.locator('.jr-control-location').count(),0);assert.equal(await p.locator('.jr-road-line').count(),0);assert.deepEqual((await props(`/road-coverages/${row.id}/edit`)).coverage.geojson,geo);await p.unroute('**/route/v1/**');pass('Stale routing response cannot restore cleared markers/geometry or alter saved data');
await p.goto(base+'/road-coverages/create');await p.waitForSelector('.jr-map-workspace');const map=await p.locator('.jr-leaflet-map').boundingBox();await p.mouse.click(map.x+300,map.y+300);allowDiscard=false;const n=dialogs;await p.getByRole('link',{name:'LGU',exact:true}).click();await p.waitForTimeout(300);assert.equal(dialogs,n+1);assert.ok(p.url().endsWith('/road-coverages/create'));allowDiscard=true;pass('Partial location-only work receives unsaved-navigation protection');
await p.setViewportSize({width:390,height:844});await edit();await p.getByRole('button',{name:'Draw',exact:true}).click();const menu=await p.locator('.jr-draw-targets').boundingBox(),stage=await p.locator('.jr-map-stage').boundingBox();assert.ok(menu.x>=stage.x&&menu.x+menu.width<=stage.x+stage.width+1);await p.screenshot({path:'review-locations/screenshots/11-narrow-draw-menu.png',fullPage:true});await p.keyboard.press('Escape');await p.getByRole('button',{name:'Road Information',exact:true}).click();await p.screenshot({path:'review-locations/screenshots/12-narrow-review.png',fullPage:true});pass('Narrow Draw menu stays inside map boundaries');assert.equal(errors.length,0);
}catch(e){
checks.push({name:e.stack,status:'FAIL'});console.error(e);

try{
await p?.screenshot({path:'review-locations/screenshots/supplemental-failure.png',fullPage:true})
}catch { /* Best-effort diagnostics; business assertions below remain authoritative. */ }

throw e
}finally{
await writeFile('review-locations/supplemental-results.json',JSON.stringify({checks,errors},null,2));await browser?.close();server.kill()
}
