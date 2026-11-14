import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';import assert from'node:assert/strict';
import{spawn}from'node:child_process';import{readFile,writeFile}from'node:fs/promises';import process from 'node:process';
import{routeFeature}from'../resources/js/lib/road-coverages/geometry.mjs';
const s=spawn('node',['tools/maintenance-project-preview/server.mjs'],{stdio:['ignore','pipe','pipe']});let browser;const checks=[],errors=[];const pass=n=>{
checks.push(n);console.log('PASS',n)
};

try{
await new Promise(r=>s.stdout.on('data',d=>{
if(String(d).includes('5179')){
r()
}
}));browser=await chromium.launch({executablePath:'/workspace/scratch/40cc43c72aeb/browser-runtime/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}:undefined});const context=await browser.newContext({viewport:{width:1536,height:1080},ignoreHTTPSErrors:true});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
const req=context.request,base='http://127.0.0.1:5179';const props=async url=>(await(await req.get(base+url,{headers:{'X-Inertia':'true'}})).json()).props;
const live=JSON.parse(await readFile('review-refinement/browser-results.json'));const a=live.routes[0].body.routes[0].geometry.coordinates,b=live.routes[2].body.routes[0].geometry.coordinates;assert.deepEqual(a.at(-1),b[0]);const geo=routeFeature([a[0],a.at(-1),b.at(-1)],[a,b]);assert.ok(geo);geo.properties.jairoads_editor={version:1,manual:[false,false]};const options=(await props('/road-coverages/create')).municipalities;const lgu=options.find(x=>x.municipality_name==='Nabunturan')??options[0];
await req.post(base+'/road-coverages',{data:{road_name:'Development road — mapping verification',lgus_id:String(lgu.id),kilometers:'1.23',pavement_type:'Concrete',state_category:'Good',geojson:geo,length_override:true}});const row=(await props('/road-coverages')).coverages.data.find(x=>x.road_name==='Development road — mapping verification');assert.ok(row);
await p.goto(`${base}/road-coverages/${row.id}/edit`);await p.waitForSelector('.jr-map-workspace');await p.getByRole('button',{name:'Road Information',exact:true}).click();await p.waitForTimeout(500);await p.locator('.jr-map-portions button').nth(1).focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>document.activeElement.textContent),' Other Routes');assert.equal(await p.locator('.jr-road-line-1').getAttribute('stroke'),'#2563eb');assert.ok((await p.locator('.jr-road-line-1').boundingBox()).width>0);pass('Keyboard summary selection focuses relevant popup action');await p.screenshot({path:'review-refinement/screenshots/11-review-popup-and-length.png',fullPage:true});await p.keyboard.press('Escape');assert.equal(await p.locator('.jr-road-context').count(),0);pass('Keyboard Escape closes popup');
await p.locator('.jr-control-location').nth(2).boundingBox();const ab=await p.locator('.jr-road-line-0').getAttribute('d');await p.locator('.jr-map-portions button').nth(1).click();await p.getByRole('button',{name:'Redraw Road',exact:true}).click();
const reference=p.locator('.leaflet-overlay-pane path[stroke="#94a3b8"]');const coords=await reference.evaluate(el=>[.25,.5,.75].map(t=>{
const v=el.getPointAtLength(el.getTotalLength()*t);const q=new DOMPoint(v.x,v.y).matrixTransform(el.getScreenCTM());

return{x:q.x,y:q.y}
}));

for(const c of coords){
await p.mouse.click(c.x,c.y);
}

await p.getByRole('button',{name:'Finish Drawing',exact:true}).click();assert.equal(await p.locator('.jr-road-line-0').getAttribute('d'),ab);pass('Manual trace can follow saved reference; unaffected automatic portion preserved');
const cbox=await p.locator('.jr-control-location').nth(2).boundingBox();await p.mouse.move(cbox.x+14,cbox.y+14);await p.mouse.down();await p.mouse.move(cbox.x+34,cbox.y+22,{steps:8});await p.mouse.up();assert.match(await p.locator('.jr-map-panel').innerText(),/Connection missing at Location C/);assert.equal(await p.locator('.jr-road-line-0').getAttribute('d'),ab);await p.screenshot({path:'review-refinement/screenshots/12-manual-connection-recovery.png',fullPage:true});await p.locator('.jr-map-modebar').getByRole('button',{name:'Undo',exact:true}).click();assert.match(await p.locator('.jr-map-portions button').nth(1).innerText(),/Complete/);pass('Manual marker move shows exact missing connection; scoped Undo restores it without changing adjacent road');
const markers=await p.locator('.jr-control-location').count();const scale=await p.locator('.leaflet-control-scale-line').innerText();const m=await p.locator('.jr-leaflet-map').boundingBox();await p.mouse.move(m.x+350,m.y+350);await p.mouse.wheel(0,-400);await p.waitForTimeout(700);assert.notEqual(await p.locator('.leaflet-control-scale-line').innerText(),scale);assert.equal(await p.locator('.jr-control-location').count(),markers);pass('Mouse-wheel zoom preserves all locations');
await p.setViewportSize({width:390,height:844});await p.locator('.jr-map-portions button').nth(1).click();await p.waitForTimeout(800);const pop=await p.locator('.jr-road-context').boundingBox(),map=await p.locator('.jr-leaflet-map').boundingBox();assert.ok(pop.x>=map.x&&pop.x+pop.width<=map.x+map.width+1);assert.ok(pop.y>=map.y&&pop.y+pop.height<=map.y+map.height+1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'review-refinement/screenshots/13-narrow-context.png',fullPage:true});pass('Narrow summary scrolls to map and popup remains within map boundaries');
assert.equal(errors.length,0);console.log('ERRORS',errors);
}finally{
await writeFile('review-refinement/supplemental-results.json',JSON.stringify({checks,errors},null,2));await browser?.close();s.kill()
}
