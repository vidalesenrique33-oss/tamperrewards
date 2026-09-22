(function(){
  const cap=window.Capacitor;
  const native=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
  window.__TAMPER_BUILD__='1.0.5-direct-id-token';
  window.__TAMPER_NATIVE__=native;
  window.TamperNative={
    active:native,
    platform:native&&cap.getPlatform?cap.getPlatform():'web',
    online:navigator.onLine,
    haptic:async()=>{},
    setTheme:async()=>{},
    loginGoogle:async()=>{throw new Error('Inicio de sesión nativo no disponible');},
    logoutGoogle:async()=>{},
  };
  document.documentElement.classList.toggle('native-app',native);
  if(!native)return;

  // En proyectos sin bundler (HTML/JS directo), instalar el paquete nativo no
  // crea automáticamente los proxies JavaScript. Los imports recomendados por
  // Capacitor ejecutan registerPlugin(); aquí hacemos el equivalente explícito.
  const getNativePlugin=name=>{
    const existing=cap.Plugins&&cap.Plugins[name];
    if(existing)return existing;
    if(typeof cap.registerPlugin!=='function')return null;
    try{return cap.registerPlugin(name);}catch(error){
      console.error(`[Tamper] No se pudo registrar el plugin ${name}`,error);
      return null;
    }
  };
  // Resuelve cada plugin cuando se usa. Firebase se obtiene hasta que el
  // usuario toca el botón, cuando el Bridge de Android ya está completamente listo.
  const plugins=new Proxy({}, {get:(_,name)=>getNativePlugin(String(name))});
  const callNative=async(pluginName,methodName,options={})=>{
    // Ruta directa al Bridge de Capacitor. No depende de que el objeto
    // window.Capacitor.Plugins haya sido exportado correctamente.
    if(typeof cap.nativePromise==='function'){
      return cap.nativePromise(pluginName,methodName,options);
    }
    const plugin=getNativePlugin(pluginName);
    const method=plugin&&plugin[methodName];
    if(typeof method==='function')return method.call(plugin,options);
    throw new Error(`${pluginName}.${methodName} no está disponible · ${window.__TAMPER_BUILD__}`);
  };
  const themeColors={
    matcha:{color:'#F4F1E9',style:'DARK'},
    halloween:{color:'#120E13',style:'LIGHT'},
    navidad:{color:'#17613F',style:'LIGHT'},
  };
  const currentTheme=()=>{
    const value=document.documentElement.getAttribute('data-theme')||'matcha';
    return themeColors[value]?value:'matcha';
  };

  window.TamperNative.setTheme=async function(theme=currentTheme()){
    const selected=themeColors[theme]||themeColors.matcha;
    try{await plugins.StatusBar?.setStyle({style:selected.style});}catch(e){}
    try{await plugins.StatusBar?.setBackgroundColor({color:selected.color});}catch(e){}
  };
  window.TamperNative.haptic=async function(kind='light'){
    try{
      if(['success','error'].includes(kind)){
        await plugins.Haptics?.notification({type:kind.toUpperCase()});
      }else{
        const style={light:'LIGHT',med:'MEDIUM',heavy:'HEAVY',double:'MEDIUM'}[kind]||'LIGHT';
        await plugins.Haptics?.impact({style});
        if(kind==='double')setTimeout(()=>plugins.Haptics?.impact({style:'MEDIUM'}).catch(()=>{}),65);
      }
    }catch(e){}
  };
  window.TamperNative.loginGoogle=async function(){
    // Puente propio de Android: pide solo el ID token. El complemento generico
    // tambien intentaba conseguir access token y server auth code, que Tamper
    // no utiliza y podian hacer fallar todo el proceso despues de elegir cuenta.
    const result=await callNative('TamperGoogleAuth','signIn',{});
    const idToken=result?.idToken;
    if(!idToken){
      const error=new Error('Google no devolvió el token de identidad');
      error.code='MISSING_ID_TOKEN';
      throw error;
    }
    return {idToken,accessToken:''};
  };
  window.TamperNative.logoutGoogle=async function(){
    try{await callNative('TamperGoogleAuth','signOut',{});}catch(e){}
    try{await callNative('FirebaseAuthentication','signOut',{});}catch(e){}
  };

  new MutationObserver(()=>window.TamperNative.setTheme(currentTheme()))
    .observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

  plugins.Network?.getStatus().then(status=>{
    window.TamperNative.online=!!status.connected;
    window.dispatchEvent(new CustomEvent('tamper:native-network',{detail:status}));
  }).catch(()=>{});
  plugins.Network?.addListener('networkStatusChange',status=>{
    window.TamperNative.online=!!status.connected;
    window.dispatchEvent(new CustomEvent('tamper:native-network',{detail:status}));
  });

  plugins.Keyboard?.addListener('keyboardWillShow',()=>document.documentElement.classList.add('native-keyboard-open'));
  plugins.Keyboard?.addListener('keyboardWillHide',()=>document.documentElement.classList.remove('native-keyboard-open'));
  plugins.App?.addListener('backButton',event=>{
    const detail={handled:false,canGoBack:!!event.canGoBack};
    window.dispatchEvent(new CustomEvent('tamper:native-back',{detail}));
    if(detail.handled)return;
    if(event.canGoBack)history.back();
    else plugins.App?.minimizeApp();
  });

  document.addEventListener('DOMContentLoaded',()=>{
    window.TamperNative.setTheme();
    setTimeout(()=>plugins.SplashScreen?.hide().catch(()=>{}),450);
  },{once:true});
})();
