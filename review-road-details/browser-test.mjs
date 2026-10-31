import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import process from 'node:process';
import { routeFeature, distanceKm } from '../resources/js/lib/road-coverages/geometry.mjs';
const base='http://127.0.0.1:5179', checks=[], errors=[], routing=[], report={checks,errors,routing};
const pass=name=>{
checks.push({name,status:'PASS'});console.log('PASS',name)
};
const server=spawn('node',['tools/maintenance-project-preview/server.mjs'],{stdio:['ignore','pipe','pipe']});
let browser,page;

try {
 await new Promise((resolve,reject)=>{
server.stdout.on('data',d=>{
if(String(d).includes('5179')){
resolve()
}
});server.stderr.on('data',d=>console.log(String(d)));setTimeout(()=>reject(Error('Preview server timeout')),10000)
});
 browser=await chromium.launch({executablePath:'/workspace/scratch/40cc43c72aeb/browser-runtime/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}:undefined});
 const ctx=await browser.newContext({viewport:{width:1536,height:1080},ignoreHTTPSErrors:true});page=await ctx.newPage();page.setDefaultTimeout(14000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('request',r=>{
if(r.url().includes('/route/v1/')){
routing.push(r.url())
}
});
 await mkdir('review-road-details/screenshots',{recursive:true});
 const shot=async n=>page.screenshot({path:`review-road-details/screenshots/${n}.png`,fullPage:true});
 const props=async url=>{
const res=await ctx.request.get(base+url,{headers:{'X-Inertia':'true'}});assert.equal(res.status(),200,url);

return (await res.json()).props
};
 const open=async url=>{
await page.goto(base+url);await page.locator('.jr-road-coverage-details').waitFor();await page.waitForTimeout(500)
};
 const geoBefore=await props('/road-coverages/create'); const reviewLgu=geoBefore.municipalities.find(lgu=>lgu.municipality_name==='Nabunturan'); assert.ok(reviewLgu);
 const live=JSON.parse(await readFile('review-refinement/browser-results.json'));
 const ab=live.routes[0].body.routes[0].geometry.coordinates,bc=live.routes[2].body.routes[0].geometry.coordinates;
 const two=routeFeature([ab[0],ab.at(-1)],[ab]);const three=routeFeature([ab[0],ab.at(-1),bc.at(-1)],[ab,bc]);assert.ok(two&&three);
 const make=async(name,geojson)=>{
await ctx.request.post(base+'/road-coverages',{data:{road_name:name,lgus_id:String(reviewLgu.id),kilometers:distanceKm(geojson.geometry.coordinates).toFixed(2),pavement_type:'Concrete',state_category:'Good',geojson}});const rows=(await props('/road-coverages?search='+encodeURIComponent(name))).coverages.data;assert.equal(rows.length,1);

return rows[0]
};
 const road2=await make('Development fixture — two-location road',two),road3=await make('Development fixture — three-location road',three);
 const projectResponse=await ctx.request.post(base+'/maintenance-projects',{data:{road_coverage_id:road3.id,project_title:'Development fixture — road maintenance',description:'Temporary browser verification relationship.'}});assert.equal(projectResponse.status(),200);const projectId=Number(new URL(projectResponse.url()).pathname.split('/').at(-1));assert.ok(projectId);
 report.fixtures={notice:'Process-local development records, not production data. Geometry is actual OSRM output captured during the prior mapping review.',two:road2.id,three:road3.id,project:projectId};
 // Directory integration, secondary menus and contextual back URL.
 await page.goto(base+'/road-coverages?search=three-location&condition=Good&sort=name-asc');
 const row=page.locator(`tr[data-road-coverage-id="${road3.id}"]`);await row.getByRole('button',{name:/Actions for/}).click();assert.match(page.url(),/\/road-coverages\?/);await page.keyboard.press('Escape');
 await row.locator('td').nth(1).click();await page.locator('.jr-road-coverage-details').waitFor();assert.match(page.url(),new RegExp(`/road-coverages/${road3.id}\\?`));assert.equal(await page.locator('h1').innerText(),road3.road_name);page.url();assert.equal((await page.locator('.jr-back').getAttribute('href')),'/road-coverages?search=three-location&condition=Good&sort=name-asc');pass('Directory full-row navigation opens the correct record; action menu remains independent; filtered directory origin is retained');
 await page.waitForSelector('.jr-saved-coverage-line');await page.waitForTimeout(700);
 const detail=await props(`/road-coverages/${road3.id}`);assert.deepEqual(detail.coverage.geojson,three);assert.equal(detail.coverage.created_by,1);assert.equal(detail.createdByName,'Andrea Santos');assert.equal(detail.associatedProject.id,projectId);assert.equal(detail.coverage.lgu.municipality_name,reviewLgu.municipality_name);assert.equal(await page.locator('.jr-saved-location').count(),3);assert.deepEqual(await page.locator('.jr-saved-location').allTextContents(),['A','B','C']);assert.equal(await page.locator('.jr-saved-coverage-line').count(),1);assert.equal(await page.locator('.jr-saved-coverage-line').getAttribute('stroke'),'#843b12');pass('Three saved locations and one exact selected road render from stored GeoJSON with correct LGU, creator and project relationship');
 assert.ok(!(await page.locator('.jr-road-coverage-details').innerText()).includes('RoadCoverageID'));assert.ok(!(await page.locator('.jr-road-coverage-details').innerText()).includes('Road Coverage ID'));assert.match(await page.locator('.jr-detail-fields').innerText(),new RegExp(distanceKm(three.geometry.coordinates).toFixed(2).replace('.','\\.')+' km'));assert.equal(await page.locator('.jr-coverage-condition').getAttribute('data-condition'),'Good');
 const map=page.locator('.jr-coverage-map-preview');let box=await map.boundingBox();assert.equal(box.height,420);const grid=await page.locator('.jr-detail-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(grid,2);const head=await page.locator('.jr-details-heading').boundingBox(),actions=await page.locator('.jr-header-actions').boundingBox();assert.ok(actions.x>head.x+head.width/2);pass('Established details header/actions, two-column proportions, 420px map, badges, length and metadata are used without exposing RoadCoverage ID');

 for(const label of ['Select','Add Location','Draw','Undo','Edit Path','Retry Route','Other Routes','Fit Route','Show Mapped Roads','All Municipalities']){
assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0,label);
}

 assert.equal(await page.locator('.jr-map-workspace,.jr-map-layers,.leaflet-control-layers,.leaflet-marker-draggable').count(),0);assert.equal(await page.getByRole('button',{name:'Delete Road Coverage',exact:true}).count(),0);pass('Editor, overlays and unsupported Delete action are absent; map and markers are read-only');
 report.loadedBasemapTiles = await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(img=>img.complete&&img.naturalWidth>0),null,{timeout:8000}).then(()=>true,()=>false); await shot('01-linked-three-location-road');
 const m=page.locator('.jr-saved-coverage-map'),path=page.locator('.jr-saved-coverage-line');const initialD=await path.getAttribute('d');await page.locator('.leaflet-control-zoom-in').click();await page.waitForTimeout(400);assert.notEqual(await path.getAttribute('d'),initialD);await page.locator('.leaflet-control-zoom-out').click();await page.waitForTimeout(400);const beforeWheel=await path.getAttribute('d');box=await m.boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6);await page.mouse.wheel(0,-350);await page.waitForTimeout(700);assert.notEqual(await path.getAttribute('d'),beforeWheel);const beforePan=await page.locator('.leaflet-map-pane').getAttribute('style');await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.6,{steps:12});await page.mouse.up();await page.waitForTimeout(300);assert.notEqual(await page.locator('.leaflet-map-pane').getAttribute('style'),beforePan);pass('Standard zoom controls, mouse-wheel zoom and panning work');
 const full=page.getByRole('button',{name:'Fullscreen road coverage map',exact:true});box=await map.boundingBox();const fbox=await full.boundingBox();assert.ok(fbox.x>box.x+box.width-60&&fbox.y>box.y+box.height-80);await full.click();await page.waitForFunction(()=>!!document.fullscreenElement);assert.ok((await map.boundingBox()).height>900);await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);pass('Established bottom-right fullscreen enters/exits and map resizes');
 await open(`/road-coverages/${road3.id}`);await page.getByRole('link',{name:'View Project',exact:true}).click();await page.locator('.jr-project-details').waitFor();assert.equal(new URL(page.url()).pathname,`/maintenance-projects/${projectId}`);assert.equal(await page.locator('h1').innerText(),'Development fixture — road maintenance');pass('View Project opens the actual associated Maintenance Project Details');
 await open(`/road-coverages/${road2.id}`);assert.equal(await page.locator('.jr-saved-location').count(),2);assert.equal(await page.getByText('No associated maintenance project.',{exact:true}).count(),1);assert.equal(await page.getByRole('link',{name:'View Project',exact:true}).count(),0);await shot('02-unassigned-two-location-road');pass('Two-location geometry displays only A/B, with the unassigned-project empty state and no assignment actions');
 const saved=await props(`/road-coverages/${road2.id}`);const navCount=routing.length;
 await page.getByRole('button',{name:'Edit Road Coverage',exact:true}).click();await page.locator('.jr-map-workspace').waitFor();assert.match(page.url(),new RegExp(`/road-coverages/${road2.id}/edit`));assert.equal(await page.getByLabel(/^Road Coverage Name/).inputValue(),road2.road_name);assert.equal(await page.locator('.jr-control-location').count(),2);assert.equal(await page.getByRole('button',{name:'Road Coverage Details',exact:true}).count(),1);await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('.jr-road-coverage-details').waitFor();assert.equal(new URL(page.url()).pathname,`/road-coverages/${road2.id}`);assert.deepEqual((await props(`/road-coverages/${road2.id}`)).coverage.geojson,two);pass('Edit loads the selected saved road; Cancel returns to its Details without geometry changes');
 await page.getByRole('button',{name:'Edit Road Coverage',exact:true}).click();await page.locator('.jr-map-workspace').waitFor();await page.getByLabel(/^Road Coverage Name/).fill('Development fixture — updated two-location road');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.locator('.jr-road-coverage-details').waitFor();const updated=await props(`/road-coverages/${road2.id}`);assert.equal(updated.coverage.road_name,'Development fixture — updated two-location road');assert.deepEqual(updated.coverage.geojson,saved.coverage.geojson);assert.equal(updated.coverage.created_by,saved.coverage.created_by);assert.equal(updated.coverage.created_at,saved.coverage.created_at);assert.equal(routing.length,navCount);pass('Information-only Edit saves back to Details, preserving exact GeoJSON, original attribution and creation timestamp without routing');
 await open('/road-coverages/1');assert.equal(await page.locator('.jr-coverage-map-empty').count(),1);assert.equal(await page.locator('.leaflet-container').count(),0);assert.equal((await props('/road-coverages/1')).associatedProject.id,101);await shot('03-missing-geography');pass('Existing record without geography displays the neutral map placeholder while retaining information and real project association');
 const override=async(geojson,extras={})=>{
await page.goto(base+'/road-coverages?search=updated%20two-location');await page.route('**/road-coverages/'+road2.id+'?**',async route=>{
if(route.request().headers()['x-inertia']){
const res=await route.fetch();const data=await res.json();Object.assign(data.props.coverage,{geojson,...extras});

if(extras.created_by===-1){
data.props.createdByName=null;
}

await route.fulfill({response:res,json:data})
}else {
await route.continue()
}
});await page.locator(`tr[data-road-coverage-id="${road2.id}"]`).getByRole('link').click();await page.locator('.jr-road-coverage-details').waitFor();await page.waitForTimeout(300)
};
 await override({type:'LineString',coordinates:[[999,7],[125,7]]},{created_by:-1,created_at:'invalid',updated_at:null});assert.equal(await page.locator('.jr-coverage-map-empty').count(),1);assert.equal(await page.locator('.jr-metadata dd').filter({hasText:'Unavailable'}).count(),3);await page.unroute('**/road-coverages/'+road2.id+'?**');pass('Invalid-geometry response and missing metadata safely show placeholder/Unavailable; no invented geography, creator or timestamps');
 await override(two.geometry);assert.equal(await page.locator('.jr-saved-coverage-line').count(),1);assert.equal(await page.locator('.jr-saved-location').count(),0);await page.unroute('**/road-coverages/'+road2.id+'?**');pass('Legacy valid LineString without waypoint metadata renders saved road only, with no fabricated location markers');
 await open(`/road-coverages/${road3.id}`);await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.waitForTimeout(300);assert.equal(await page.getByRole('button',{name:'Expand sidebar',exact:true}).count(),1);await shot('04-collapsed-sidebar');pass('Sidebar active state/collapse work with the new Details route');
 await page.setViewportSize({width:390,height:844});await open(`/road-coverages/${road3.id}`);box=await map.boundingBox();const info=await page.locator('.jr-detail-fields').boundingBox();assert.ok(box.y>info.y+info.height);assert.equal(box.height,360);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('05-narrow-details');await page.setViewportSize({width:320,height:780});await open(`/road-coverages/${road3.id}`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));pass('390px and 320px layouts stack information over map, wrap metadata/actions and avoid horizontal overflow');
 await page.setViewportSize({width:1536,height:1080});await page.goto(base+'/road-coverages/create');await page.locator('.jr-map-workspace').waitFor();

for(const name of ['Add Location','Select','Draw']){
assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
}

assert.equal(await page.locator('.jr-road-coverage-details').count(),0);await page.goto(base+'/maintenance-projects/101');await page.locator('.jr-project-details').waitFor();assert.equal(await page.getByRole('heading',{name:'Maintenance History',exact:true}).count(),1);await shot('06-reference-project-details');await page.goto(base+'/maintenance-projects/create');await page.getByRole('heading',{name:'Add Project',exact:true}).waitFor();await shot('07-reference-add-project');pass('Existing Add Road Coverage toolbar, Add Project and Maintenance Project Details/Maintenance History remain available');
 const denied=await ctx.request.delete(base+`/road-coverages/${road3.id}`);assert.equal(denied.status(),404);assert.deepEqual((await props(`/road-coverages/${road3.id}`)).coverage.geojson,three);assert.equal((await props(`/maintenance-projects/${projectId}`)).project.road_coverage_id,road3.id);pass('Unsupported delete remains unavailable; rejected request changes neither road nor project relationship');
 // Refresh final deliverable captures after network/cache warmup, without altering the basemap.
 const waitTiles=async()=>page.waitForFunction(()=>{
const imgs=[...document.querySelectorAll('.leaflet-tile')];

return imgs.length>0&&imgs.every(i=>i.complete&&i.naturalWidth>0)
},null,{timeout:10000}).then(()=>true,()=>false);
 await open(`/road-coverages/${road3.id}`);report.finalDesktopBasemapLoaded=await waitTiles();await shot('01-linked-three-location-road');
 await open(`/road-coverages/${road2.id}`);await waitTiles();await shot('02-unassigned-two-location-road');
 await open('/road-coverages/1');await shot('03-missing-geography');
 await open(`/road-coverages/${road3.id}`);await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.waitForTimeout(300);await waitTiles();await shot('04-collapsed-sidebar');
 await page.setViewportSize({width:390,height:844});await open(`/road-coverages/${road3.id}`);await waitTiles();await shot('05-narrow-details');
 assert.equal(routing.length,0);assert.deepEqual(errors,[]);pass('All Details/navigation/edit-load checks send zero routing requests and raise zero runtime errors');
 report.supplementalNote='Invalid and legacy geometry cases used explicit browser response fixtures; saved two/three-point cases used actual process-local creation workflows. No permanent fixtures were changed.';
} catch(e){
checks.push({name:'Browser suite',status:'FAIL',error:e.stack});console.error(e);

if(page){
await page.screenshot({path:'review-road-details/failure.png',fullPage:true}).catch(()=>{});
}

process.exitCode=1
} finally {
await writeFile('review-road-details/browser-results.json',JSON.stringify(report,null,2));await browser?.close();server.kill('SIGTERM')
}
