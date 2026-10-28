const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../www/nfc-reader.js'),'utf8');
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
function setup(t,options={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><body><main id="root"></main><button aria-label="Mostrar mi código QR">Mi QR</button></body></html>',{url:'https://localhost',runScripts:'outside-only',virtualConsole:vc});
 t.after(async()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));await flush();dom.window.close();await flush();assert.deepEqual(errors,[],'No uncaught DOM errors allowed');});
 const w=dom.window,d=w.document,calls=[],requests=[];
 let supported=options.supported!==false,enabled=options.enabled!==false,qr=0;
 d.querySelector('[aria-label="Mostrar mi código QR"]').onclick=()=>qr++;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 const cap={isNativePlatform:()=>options.native!==false,getPlatform:()=>options.platform||'android',registerPlugin:()=>({}),nativePromise:async(plugin,method)=>{
  calls.push({plugin,method});
  if(method==='getStatus'){if(options.statusError)throw Error('status unavailable');return{supported,enabled};}
  if(method==='startScan')return new Promise((resolve,reject)=>requests.push({resolve,reject}));
  if(method==='stopScan'&&!options.delayedStop){for(const r of requests)r.reject(Object.assign(Error('cancelled'),{code:'NFC_CANCELLED'}));}
  return {};
 }};
 w.Capacitor=cap;
 w.__tf=new Proxy({},{get(){throw Error('NFC must not access Firebase');}});
 w.eval(source);
 const home=()=>{const e=d.createElement('section');e.className='clean-home';e.innerHTML='<header class="clean-topbar">Hola</header>';d.querySelector('#root').append(e);return e;};
 return {w,d,calls,requests,home,enabled(value){enabled=value;},qr:()=>qr,
  async open(){d.querySelector('.tnfc-entry-main').click();await flush();},
  click(action){d.querySelector(`[data-nfc="${action}"]`).click();},
  resolve(value={ndef:true}){requests.at(-1).resolve(value);},
  reject(code){requests.at(-1).reject(Object.assign(Error('native error'),{code}));},
  state(){return d.querySelector('#tamper-nfc-dialog')?.dataset.state;}};
}
test('Entry mounts only when authenticated home appears; no duplicate on repeated mutations',async t=>{
 const a=setup(t);assert.equal(a.d.querySelector('#tamper-nfc-entry'),null);a.home();await flush();assert.equal(a.d.querySelectorAll('#tamper-nfc-entry').length,1);
 for(let i=0;i<3;i++)a.d.querySelector('header').append(a.d.createTextNode(' '));await flush();assert.equal(a.d.querySelectorAll('#tamper-nfc-entry').length,1);
});
test('Reader does not appear on web or iOS',async t=>{
 for(const opts of [{native:false},{platform:'ios'}]){const a=setup(t,opts);a.home();await flush();assert.equal(a.d.querySelector('#tamper-nfc-entry'),null);assert.equal(a.calls.length,0);}
});
test('Main action starts the native reader once; no scan on page load',async t=>{
 const a=setup(t);a.home();await flush();assert.equal(a.calls.length,0);await a.open();await a.open();assert.equal(a.state(),'scanning');assert.equal(a.calls.filter(c=>c.method==='startScan').length,1);
});
test('Tag read is explicitly a reader test and never grants a reward',async t=>{
 const a=setup(t);a.home();await flush();await a.open();a.resolve();await flush();assert.equal(a.state(),'read');assert.match(a.d.querySelector('#tnfc-message').textContent,/todavía no acredita sellos/);assert.deepEqual([...new Set(a.calls.map(c=>c.plugin))],['TamperNfc']);
});
test('Raw malicious payload is never displayed or followed',async t=>{
 const a=setup(t);a.home();await flush();await a.open();a.resolve({ndef:true,url:'javascript:alert(1)',payload:'<img src=x onerror=alert(1)>',rewardGranted:true});await flush();assert.equal(a.state(),'read');assert.equal(a.d.querySelectorAll('img').length,0);assert.equal(a.d.querySelectorAll('a').length,0);assert.doesNotMatch(a.d.body.textContent,/javascript:|onerror/);
});
test('Non-NDEF detection is reported without authenticating a Tamper stamp',async t=>{
 const a=setup(t);a.home();await flush();await a.open();a.resolve({ndef:false});await flush();assert.match(a.d.querySelector('#tnfc-message').textContent,/sin contenido NDEF/);assert.match(a.d.querySelector('#tnfc-message').textContent,/no acredita/);
});
test('No NFC hardware retains QR and never starts scanning',async t=>{
 const a=setup(t,{supported:false});a.home();await flush();await a.open();assert.equal(a.state(),'unsupported');assert.equal(a.calls.some(c=>c.method==='startScan'),false);a.click('qr');await flush();assert.equal(a.qr(),1);
});
test('NFC disabled leads to settings and a deliberate retry',async t=>{
 const a=setup(t,{enabled:false});a.home();await flush();await a.open();assert.equal(a.state(),'disabled');a.click('settings');await flush();assert.equal(a.calls.some(c=>c.method==='openSettings'),true);a.enabled(true);a.click('retry');await flush();assert.equal(a.state(),'scanning');
});
test('Close cancels scan, restores focus and ignores late data',async t=>{
 const a=setup(t,{delayedStop:true});a.home();await flush();await a.open();const r=a.requests[0];a.click('close');await flush();r.resolve({ndef:true});await flush();assert.equal(a.d.querySelector('dialog').open,false);assert.equal(a.calls.some(c=>c.method==='stopScan'),true);assert.equal(a.d.activeElement.className,'tnfc-entry-main');
});
test('A previous scan cannot replace the result of a new session',async t=>{
 const a=setup(t,{delayedStop:true});a.home();await flush();await a.open();const old=a.requests[0];a.click('close');await flush();await a.open();a.resolve({ndef:true});await flush();old.resolve({ndef:false});await flush();assert.match(a.d.querySelector('#tnfc-message').textContent,/pudo leer/);assert.doesNotMatch(a.d.querySelector('#tnfc-message').textContent,/sin contenido NDEF/);
});
test('Native back closes only the reader and marks event handled',async t=>{
 const a=setup(t);a.home();await flush();await a.open();const detail={handled:false};a.w.dispatchEvent(new a.w.CustomEvent('tamper:native-back',{detail}));await flush();assert.equal(detail.handled,true);assert.equal(a.d.querySelector('dialog').open,false);
});
test('QR remains the original action from both entry and dialog',async t=>{
 const a=setup(t);a.home();await flush();a.d.querySelector('.tnfc-entry-qr').click();await flush();assert.equal(a.qr(),1);await a.open();a.click('qr');await flush();assert.equal(a.qr(),2);assert.equal(a.d.querySelector('dialog').open,false);
});
test('Timeout and lost tag have recoverable messages',async t=>{
 for(const code of ['NFC_TIMEOUT','NFC_TAG_LOST','NFC_INTERRUPTED','NFC_TOO_LARGE','NFC_READ_FAILED','UNIMPLEMENTED']){
  const a=setup(t);a.home();await flush();await a.open();a.reject(code);await flush();assert.equal(a.state(),'error');assert.equal(a.d.querySelector('[data-nfc="retry"]').hidden,false);assert.equal(a.d.querySelector('[data-nfc="qr"]').hidden,false);
 }
});
test('User can retry a failed scan without duplicate concurrent requests',async t=>{
 const a=setup(t);a.home();await flush();await a.open();a.reject('NFC_TIMEOUT');await flush();a.click('retry');a.click('retry');await flush();assert.equal(a.requests.length,2);assert.equal(a.state(),'scanning');
});
test('Closing the authenticated home cancels the reader',async t=>{
 const a=setup(t);const h=a.home();await flush();await a.open();h.remove();await flush();assert.equal(a.d.querySelector('dialog').open,false);assert.ok(a.calls.some(c=>c.method==='stopScan'));
});
test('Going to background stops scanning; returning does not silently restart it',async t=>{
 const a=setup(t);a.home();await flush();await a.open();Object.defineProperty(a.d,'hidden',{value:true,configurable:true});a.d.dispatchEvent(new a.w.Event('visibilitychange'));await flush();assert.equal(a.state(),'error');Object.defineProperty(a.d,'hidden',{value:false,configurable:true});a.d.dispatchEvent(new a.w.Event('visibilitychange'));await flush();assert.equal(a.calls.filter(c=>c.method==='startScan').length,1);
});
test('Status failure is contained with a retry and QR',async t=>{
 const a=setup(t,{statusError:true});a.home();await flush();await a.open();assert.equal(a.state(),'error');assert.equal(a.requests.length,0);
});
test('Android declares optional NFC and preserves the existing QR identity',()=>{
 const root=path.join(__dirname,'..');const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');const html=fs.readFileSync(path.join(root,'www/index.html'),'utf8');
 assert.match(manifest,/android.permission.NFC/);assert.match(manifest,/android.hardware.nfc" android:required="false"/);assert.match(html,/'TAMPER_CLIENT_'\+this\.u\.uid/);
 const java=fs.readFileSync(path.join(root,'android/app/src/main/java/com/tamper/rewards/TamperNfcPlugin.java'),'utf8');assert.doesNotMatch(java,/writeNdef|HttpClient|URLConnection|Firestore|FirebaseDatabase|Log\./);assert.match(java,/rewardGranted", false/);
});
