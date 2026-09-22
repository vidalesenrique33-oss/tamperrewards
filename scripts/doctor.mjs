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
new vm.Script(read('www/native-bridge.js'),{filename:'native-bridge.js'});
assert.equal(pkg.dependencies['@capacitor/core'],'8.5.2');
assert.equal(pkg.dependencies['@capacitor-firebase/authentication'],'^8.5.2');
assert.deepEqual(cap.plugins.FirebaseAuthentication.providers,['google.com']);
assert.equal(cap.plugins.FirebaseAuthentication.skipNativeAuth,true);
assert.match(html,/signInWithCredential/,'Falta enlazar la credencial nativa con Firebase web');
assert.match(read('www/native-bridge.js'),/auth\.signInWithGoogle/,'Falta Google Sign-In nativo');
assert.match(androidWorkflow,/java-version:\s*["']21["']/,'El constructor Android debe usar Java 21');
assert.match(androidWorkflow,/debug\.keystore/,'El constructor debe conservar una firma de prueba estable');
for(const platform of ['android','ios']){
  assert.ok(fs.existsSync(new URL('../'+platform,import.meta.url)),`Falta el proyecto ${platform}`);
}
console.log('Tamper Rewards Mobile: estructura, identificador, puente nativo y plataformas correctos.');
