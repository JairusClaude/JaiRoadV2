// Real disposable Laravel/Fortify and PostgreSQL; packaged mobile assets, simulated Android bridge and network.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import process from 'node:process';
import { pdf, png, startStorageMock } from './private-storage-mock.mjs';

const base=process.env.QUARTERLY_BROWSER_URL;
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL,'DISPOSABLE_LOCAL_ONLY');
const fixture=JSON.parse(await readFile(process.env.QUARTERLY_BROWSER_FIXTURE,'utf8'));
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const storage=await startStorageMock();
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
const root=resolve('mobile/android-pilot/build/web');
const shell='/jairoads-android-pilot/';
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',
    userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 JaiROADSField/0.5.1'});
let offline=false;
await context.addInitScript(()=>{
    window.JaiRoadsHost={postMessage:()=>{}};
    Object.defineProperty(navigator,'onLine',{get:()=>!window.top.__qaOffline,configurable:true});
});
await context.route('https://**/*',r=>r.request().url().includes('tile.openstreetmap.org')&&!offline?r.fulfill({contentType:'image/png',body:png}):r.abort());
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'};
await context.route(base+'/**',async r=>{
    const path=new URL(r.request().url()).pathname;
    const file=path.startsWith(shell)?path.slice(shell.length):path.startsWith('/build/')?'site-build/'+path.slice(7):path.startsWith('/images/')?'site-images/'+path.slice(8):null;
    if(file!==null){
        const actual=resolve(root,file);
        if(!actual.startsWith(root+'/'))return r.abort();
        try{if(!(await stat(actual)).isFile())throw new Error('not a file');
            return r.fulfill({body:await readFile(actual),contentType:mime[extname(actual)]||'application/octet-stream'});
        }catch{return r.fulfill({status:404,body:'asset not found'});}
    }
    if(offline)return r.abort();
    return r.continue();
});
const page=await context.newPage();
page.on('pageerror',e=>console.error('BROWSER ERROR:',e.message));
page.on('console',m=>{if(m.type()==='error')console.log('BROWSER CONSOLE:',m.text().slice(0,250));});
page.setDefaultTimeout(18000);
async function signIn(){
    await page.goto(base+shell+'index.html');
    await page.locator('#continue').click();
    await page.locator('#email').fill(fixture.engineer_email);
    await page.locator('#password').fill('Disposable-Test!123');
    await page.locator('#submit').click();
    await page.locator('#shared-workspace[data-ready=true]').waitFor({timeout:25000});
    await page.frameLocator('#shared-workspace').getByRole('heading',{name:'Engineering Dashboard'}).waitFor();
}
async function request(path,method='get',data={}){
    return page.evaluate(async ({path,method,data})=>{
        const result=await window.JaiRoadsSharedWorkspace.request({url:location.origin+path,method,data,headers:{}});
        return result?JSON.parse(result.data):null;
    },{path,method,data});
}
async function localResource(path){
    return page.evaluate(async path=>{
        const r=await window.JaiRoadsSharedWorkspace.resource(location.origin+path);
        return r?{status:r.status,bytes:(await r.blob()).size}:null;
    },path);
}
try{
    await signIn();
    console.log('PASS canonical dashboard in packaged workspace after real sign-in');
    await page.waitForFunction(async id=>window.JaiRoadsSharedWorkspace?.hasLocalFile(location.origin+'/workspace/files/document/'+id),fixture.document_id,{timeout:20000});
    assert.ok(storage.counts.downloads>0);
    const frame=page.frameLocator('#shared-workspace');
    offline=true;
    await page.evaluate(()=>{window.__qaOffline=true;window.dispatchEvent(new Event('jairoads-link-down'));});
    await frame.getByText('Offline Mode',{exact:false}).first().waitFor();
    assert.ok(await frame.getByRole('heading',{name:'Engineering Dashboard'}).isVisible());
    console.log('PASS original dashboard remains mounted and theme status appears offline');
    const ui='/workspace/ui';
    const paths=[
        [ui+'/maintenance-projects','MaintenanceProjects/Index'],
        [ui+'/maintenance-projects/'+fixture.project_id,'MaintenanceProjects/Show'],
        [ui+'/maintenance-projects/'+fixture.project_id+'/records/'+fixture.record_id,'MaintenanceProjects/Records/Show'],
        [ui+'/maintenance-records','MaintenanceRecords/Index'],
        [ui+'/road-coverages','RoadCoverages/Index'],
        [ui+'/monthly-updates','MonthlyUpdates/Index'],
        [ui+'/maintenance-documents/'+fixture.document_id,'MaintenanceDocuments/Show'],
        [ui+'/lgus/'+fixture.lgu_id,'LGUs/Show']
    ];
    for(const [path,component] of paths){
        const result=await request(path);
        assert.equal(result?.component,component,path);
        assert.equal(result.props.offlineSnapshot,true);
        console.log('PASS cached canonical page projection',component);
    }
    const file=await localResource('/workspace/files/document/'+fixture.document_id);
    assert.equal(file?.status,200);
    assert.equal(file.bytes,pdf.length);
    const geometry=await localResource('/workspace/dashboard/map-roads');
    assert.equal(geometry?.status,200);
    const create=await request(ui+'/maintenance-projects/create');
    assert.equal(create.component,'MaintenanceProjects/Create');
    const road=create.props.coverages.find(r=>!r.assigned);
    assert.ok(road,'disposable fixture must have an unassigned cached road');
    const saved=await request(ui+'/maintenance-projects','post',{road_coverage_id:road.id,project_title:'Offline shared workspace QA',description:'Disposable local-only verification'});
    assert.match(saved.props.status,/Saved locally/);
    const report=await request(ui+'/maintenance-projects');
    assert.ok(report.props.projects.data.some(p=>p.project_title==='Offline shared workspace QA'));
    console.log('PASS cached private file, road geometry and persisted local project');
    offline=false;
    const sync=page.waitForResponse(r=>r.url().endsWith('/android-field/operations')&&r.request().method()==='POST'&&r.status()===200,{timeout:30000});
    await page.evaluate(()=>{window.__qaOffline=false;window.dispatchEvent(new Event('jairoads-link-up'));});
    await sync;
    console.log('PASS pending project synchronized to disposable PostgreSQL');
    console.log('ANDROID_SHARED_WORKSPACE_QA_PASS');
}catch(error){
    console.error('Shell:',(await page.locator('body').innerText()).slice(0,1600));
    for(const f of page.frames().slice(1))console.error('Frame:',f.url(),(await f.locator('body').innerText()).slice(0,1600));
    throw error;
}finally{
    await browser.close();
    await storage.close();
}
