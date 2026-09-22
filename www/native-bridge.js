(function(){
  const cap=window.Capacitor;
  const native=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
  window.__TAMPER_BUILD__='1.0.7-push-receiver';
  window.__TAMPER_NATIVE__=native;
  window.TamperNative={
    active:native,
    platform:native&&cap.getPlatform?cap.getPlatform():'web',
    online:navigator.onLine,
    haptic:async()=>{},
    setTheme:async()=>{},
    loginGoogle:async()=>{throw new Error('Inicio de sesión nativo no disponible');},
    logoutGoogle:async()=>{},
    getPushPermission:async()=>({receive:'denied'}),
    enablePush:async()=>({receive:'denied'}),
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
  let pushListenersReady=false;
  const emitPush=(name,detail)=>{
    if(name==='tamper:push-token')window.__TAMPER_PUSH_TOKEN__=detail;
    if(name==='tamper:push-action')window.__TAMPER_PENDING_PUSH_ACTION__=detail;
    window.dispatchEvent(new CustomEvent(name,{detail}));
  };
  const ensurePushListeners=async()=>{
    if(pushListenersReady)return;
    const push=getNativePlugin('PushNotifications');
    if(!push||typeof push.addListener!=='function')throw new Error('PushNotifications no está disponible');
    await push.addListener('registration',token=>{
      emitPush('tamper:push-token',{value:token?.value||'',platform:cap.getPlatform?cap.getPlatform():'android'});
    });
    await push.addListener('registrationError',error=>{
      emitPush('tamper:push-error',{message:error?.error||error?.message||'No se pudo registrar el teléfono'});
    });
    await push.addListener('pushNotificationReceived',notification=>{
      emitPush('tamper:push-received',{notification,data:notification?.data||{}});
    });
    await push.addListener('pushNotificationActionPerformed',action=>{
      const notification=action?.notification||{};
      emitPush('tamper:push-action',{notification,data:notification?.data||{},actionId:action?.actionId||'tap'});
    });
    pushListenersReady=true;
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
  window.TamperNative.getPushPermission=async function(){
    const push=getNativePlugin('PushNotifications');
    if(!push||typeof push.checkPermissions!=='function')return {receive:'denied'};
    await ensurePushListeners();
    return push.checkPermissions();
  };
  window.TamperNative.enablePush=async function(){
    const push=getNativePlugin('PushNotifications');
    if(!push)throw new Error('PushNotifications no está incluido en esta compilación');
    await ensurePushListeners();
    let permission=await push.checkPermissions();
    if(String(permission?.receive||'').startsWith('prompt'))permission=await push.requestPermissions();
    if(permission?.receive!=='granted')return permission;
    try{
      await push.createChannel({
        id:'tamper_updates',
        name:'Pedidos, recompensas y promociones',
        description:'Estados de Pick & Go, recompensas, promociones y recordatorios de Tamper',
        importance:5,
        visibility:1,
        vibration:true,
      });
    }catch(error){console.warn('[Tamper] No se pudo crear el canal de notificaciones',error);}
    await push.register();
    return permission;
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
