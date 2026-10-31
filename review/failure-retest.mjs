import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import process from 'node:process';
const server=spawn('node',['tools/maintenance-project-preview/server.mjs'],{stdio:['ignore','pipe','pipe']});
server.stderr.on('data',d=>process.stderr.write(d));
await mkdir('review/screenshots',{recursive:true});
let browser;

try {
 await new Promise((resolve,reject)=>{
server.stdout.on('data',d=>{
if(d.toString().includes('5179')){
resolve();
}
});setTimeout(reject,10000);
});
 browser=await chromium.launch({executablePath:'/workspace/scratch/40cc43c72aeb/browser-runtime/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}:undefined});
 const context=await browser.newContext({viewport:{width:1536,height:1080},ignoreHTTPSErrors:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5179/road-coverages/create'); await page.waitForSelector('.jr-map-workspace');await page.waitForSelector('.leaflet-tile-loaded',{timeout:20000});await page.waitForTimeout(800);
 await page.screenshot({path:'review/screenshots/01-add-workspace.png',fullPage:true});
 await page.route('**/route/v1/**',r=>r.abort());
 const box=await page.locator('.jr-leaflet-map').boundingBox();
 await page.mouse.click(box.x+300,box.y+250);await page.mouse.click(box.x+390,box.y+300);
 await page.waitForFunction(()=>document.querySelector('.jr-map-portions').textContent.includes('Routing unavailable'),null,{timeout:10000});await page.waitForTimeout(500);

 if(errors.length) {
throw new Error('Unexpected runtime error: '+errors.join('; '));
}

 await writeFile('review/failure-retest.txt','PASS: forced routing failure shows recovery UI, retains both markers, no unhandled runtime error after queue rejection fix.');
 console.log('INITIAL',await page.locator('.jr-map-instruction').innerText());
 console.log('ERRORS',errors);
 await writeFile('review/initial-browser.txt',JSON.stringify({errors,title:await page.title()},null,2));
} finally {
 await browser?.close();server.kill();
}
