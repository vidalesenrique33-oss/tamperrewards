import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
for(const file of ['package.json','capacitor.config.json','www/index.html','www/native-bridge.js']){
  assert.ok(fs.existsSync(new URL('../'+file,import.meta.url)),`Falta ${file}`);
}
const pkg=JSON.parse(read('package.json'));
const cap=JSON.parse(read('capacitor.config.json'));
const html=read('www/index.html');
const androidWorkflow=read('.github/workflows/build-android-apk.yml');
assert.equal(cap.appId,'com.tamper.rewards');
assert.equal(cap.appName,'Tamper Rewards');
assert.equal(cap.webDir,'www');
assert.match(html,/native-bridge\.js/);
assert.match(html,/__TAMPER_NATIVE__/);
const nativeBridge=read('www/native-bridge.js');
const nativeBridgeScript=new vm.Script(nativeBridge,{filename:'native-bridge.js'});
assert.equal(pkg.dependencies['@capacitor/core'],'8.5.2');
assert.equal(pkg.dependencies['@capacitor-firebase/authentication'],'^8.5.2');
assert.deepEqual(cap.plugins.FirebaseAuthentication.providers,['google.com']);
assert.equal(cap.plugins.FirebaseAuthentication.skipNativeAuth,true);
assert.match(html,/signInWithCredential/,'Falta enlazar la credencial nativa con Firebase web');
assert.match(nativeBridge,/auth\.signInWithGoogle/,'Falta Google Sign-In nativo');
assert.match(nativeBridge,/registerPlugin\(name\)/,'Los plugins nativos deben registrarse en una app sin bundler');
assert.match(nativeBridge,/useCredentialManager:false/,'Falta respaldo de Google Sign-In para Android');
assert.match(read('android/variables.gradle'),/androidxCredentialsVersion\s*=\s*'1\.6\.0'/,'Versión principal de Credential Manager incorrecta');
assert.match(read('android/variables.gradle'),/androidxCredentialsPlayServicesAuthVersion\s*=\s*'1\.6\.0'/,'Las bibliotecas de Credential Manager deben usar la misma versión');
assert.match(androidWorkflow,/java-version:\s*["']21["']/,'El constructor Android debe usar Java 21');
assert.match(androidWorkflow,/debug\.keystore/,'El constructor debe conservar una firma de prueba estable');
for(const platform of ['android','ios']){
  assert.ok(fs.existsSync(new URL('../'+platform,import.meta.url)),`Falta el proyecto ${platform}`);
}

// Simula el arranque Android. Esto detecta el caso en que el código nativo está
// compilado, pero el proxy JavaScript nunca fue registrado y el botón no puede
// invocar FirebaseAuthentication.
const registered=[];
const googleCalls=[];
const makePlugin=name=>{
  if(name==='FirebaseAuthentication')return {
    signInWithGoogle:async options=>{
      googleCalls.push(options);
      return {credential:{idToken:'tamper-test-token',accessToken:'tamper-test-access'}};
    },
    signOut:async()=>{},
  };
  if(name==='Network')return {
    getStatus:async()=>({connected:true}),
    addListener:async()=>({remove:async()=>{}}),
  };
  return new Proxy({}, {get:()=>async()=>({remove:async()=>{}})});
};
const capacitor={
  Plugins:{},
  PluginHeaders:[{name:'FirebaseAuthentication',methods:[{name:'signInWithGoogle',rtype:'promise'}]}],
  isNativePlatform:()=>true,
  getPlatform:()=> 'android',
  registerPlugin(name){
    registered.push(name);
    const plugin=makePlugin(name);
    this.Plugins[name]=plugin;
    return plugin;
  },
  isPluginAvailable:name=>registered.includes(name),
};
const documentElement={
  classList:{toggle:()=>{},add:()=>{},remove:()=>{}},
  getAttribute:()=> 'matcha',
};
const sandbox={
  console,
  navigator:{onLine:true},
  document:{documentElement,addEventListener:()=>{}},
  MutationObserver:class{observe(){}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  history:{back:()=>{}},
  setTimeout:()=>0,
};
sandbox.window={Capacitor:capacitor,dispatchEvent:()=>{}};
vm.createContext(sandbox);
nativeBridgeScript.runInContext(sandbox);
const nativeCredential=await sandbox.window.TamperNative.loginGoogle();
assert.ok(registered.includes('FirebaseAuthentication'),'FirebaseAuthentication no se registró al arrancar');
assert.equal(googleCalls.length,1,'Google Sign-In nativo no fue invocado exactamente una vez');
assert.equal(googleCalls[0].useCredentialManager,false,'Android debe intentar primero el selector clásico');
assert.equal(nativeCredential.idToken,'tamper-test-token');
console.log('Tamper Rewards Mobile: estructura, identificador, puente nativo y plataformas correctos.');
