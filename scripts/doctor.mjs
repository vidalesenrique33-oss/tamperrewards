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
const mainActivity=read('android/app/src/main/java/com/tamper/rewards/MainActivity.java');
const tamperGooglePlugin=read('android/app/src/main/java/com/tamper/rewards/TamperGoogleAuthPlugin.java');
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
assert.match(nativeBridge,/callNative\('TamperGoogleAuth','signIn'/,'Falta Google Sign-In nativo directo');
assert.match(nativeBridge,/registerPlugin\(name\)/,'Los plugins nativos deben registrarse en una app sin bundler');
assert.match(nativeBridge,/1\.0\.6-fixed-apk-signature/,'Falta la marca verificable de esta compilación');
assert.match(nativeBridge,/cap\.nativePromise\(pluginName,methodName,options\)/,'Google debe usar directamente el Bridge nativo');
assert.match(mainActivity,/registerPlugin\(FirebaseAuthenticationPlugin\.class\)/,'MainActivity debe registrar Firebase Authentication explícitamente');
assert.match(mainActivity,/registerPlugin\(TamperGoogleAuthPlugin\.class\)/,'MainActivity debe registrar el acceso minimo de Google');
assert.match(tamperGooglePlugin,/requestIdToken\(webClientId\)/,'El puente debe solicitar el ID token');
assert.doesNotMatch(tamperGooglePlugin,/requestServerAuthCode|GoogleAuthUtil\.getToken/,'El puente no debe pedir credenciales que Tamper no usa');
const androidBuild=read('android/app/build.gradle');
assert.match(androidBuild,/versionCode\s+7/,'Android debe generar una actualización distinguible');
assert.match(androidBuild,/rootProject\.file\(['"]tamper-debug\.keystore['"]\)/,'Gradle debe usar la llave estable explícita');
assert.match(androidBuild,/debug\s*\{[\s\S]*signingConfig\s+signingConfigs\.tamperDebug/,'La compilación debug debe fijar su firma');
assert.match(read('android/app/build.gradle'),/play-services-auth/,'La app debe compilar el selector de cuentas de Google');
assert.match(read('android/variables.gradle'),/playServicesAuthVersion\s*=\s*'20\.7\.0'/,'Falta fijar la versión de Google Sign-In');
assert.match(read('android/variables.gradle'),/androidxCredentialsVersion\s*=\s*'1\.6\.0'/,'Versión principal de Credential Manager incorrecta');
assert.match(read('android/variables.gradle'),/androidxCredentialsPlayServicesAuthVersion\s*=\s*'1\.6\.0'/,'Las bibliotecas de Credential Manager deben usar la misma versión');
assert.match(androidWorkflow,/java-version:\s*["']21["']/,'El constructor Android debe usar Java 21');
assert.match(androidWorkflow,/debug\.keystore/,'El constructor debe conservar una firma de prueba estable');
assert.match(androidWorkflow,/cp "\$HOME\/\.android\/debug\.keystore" android\/tamper-debug\.keystore/,'El constructor debe entregar a Gradle la llave verificada');
assert.match(androidWorkflow,/node scripts\/apk-signature\.mjs[^\n]+--sha1/,'El constructor debe leer la firma real del APK');
assert.doesNotMatch(androidWorkflow,/se publicará para permitir la prueba/,'Una firma no verificable nunca debe publicarse');
for(const platform of ['android','ios']){
  assert.ok(fs.existsSync(new URL('../'+platform,import.meta.url)),`Falta el proyecto ${platform}`);
}

// Simula el arranque Android. Esto detecta el caso en que el código nativo está
// compilado, pero el proxy JavaScript nunca fue registrado y el botón no puede
// invocar FirebaseAuthentication.
const registered=[];
const googleCalls=[];
const makePlugin=name=>{
  if(name==='TamperGoogleAuth')return {
    signIn:async options=>{
      googleCalls.push(options);
      return {idToken:'tamper-test-token'};
    },
    signOut:async()=>{},
  };
  if(name==='FirebaseAuthentication')return {signOut:async()=>{}};
  if(name==='Network')return {
    getStatus:async()=>({connected:true}),
    addListener:async()=>({remove:async()=>{}}),
  };
  return new Proxy({}, {get:()=>async()=>({remove:async()=>{}})});
};
const capacitor={
  Plugins:{},
  PluginHeaders:[{name:'TamperGoogleAuth',methods:[{name:'signIn',rtype:'promise'}]}],
  isNativePlatform:()=>true,
  getPlatform:()=> 'android',
  registerPlugin(name){
    registered.push(name);
    const plugin=makePlugin(name);
    this.Plugins[name]=plugin;
    return plugin;
  },
  isPluginAvailable:name=>registered.includes(name),
  async nativePromise(pluginName,methodName,options){
    googleCalls.push({pluginName,methodName,options});
    if(pluginName==='TamperGoogleAuth'&&methodName==='signIn'){
      return {idToken:'tamper-test-token'};
    }
    return {};
  },
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
assert.equal(googleCalls.length,1,'Google Sign-In nativo no fue invocado exactamente una vez');
assert.equal(googleCalls[0].pluginName,'TamperGoogleAuth');
assert.equal(googleCalls[0].methodName,'signIn');
assert.equal(nativeCredential.idToken,'tamper-test-token');
console.log('Tamper Rewards Mobile: estructura, identificador, puente nativo y plataformas correctos.');
