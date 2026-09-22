(function(){
  const cap=window.Capacitor;
  const native=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
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

  const plugins=cap.Plugins||{};
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
    const auth=plugins.FirebaseAuthentication;
    if(!auth)throw new Error('Firebase Authentication no está incluido en esta compilación');
    let result;
    try{
      // Credential Manager es el flujo moderno de Android, pero algunos
      // dispositivos/cuentas pueden devolver NoCredentialException antes de
      // mostrar el selector. En ese caso usamos el selector clásico oficial.
      result=await auth.signInWithGoogle({skipNativeAuth:true,useCredentialManager:true});
    }catch(primaryError){
      const primaryMessage=String(primaryError?.message||primaryError||'');
      const primaryCode=String(primaryError?.code||'');
      if(/cancel|canceled|cancelled|user.*closed/i.test(`${primaryCode} ${primaryMessage}`))throw primaryError;
      try{
        result=await auth.signInWithGoogle({skipNativeAuth:true,useCredentialManager:false});
      }catch(fallbackError){
        const fallbackMessage=String(fallbackError?.message||fallbackError||'Error desconocido');
        const fallbackCode=String(fallbackError?.code||primaryCode||'GOOGLE_SIGN_IN_FAILED');
        const error=new Error(fallbackMessage);
        error.code=fallbackCode;
        error.primaryError=`${primaryCode} ${primaryMessage}`.trim();
        throw error;
      }
    }
    const idToken=result?.credential?.idToken;
    if(!idToken)throw new Error('Google no devolvió el token de identidad');
    return {idToken};
  };
  window.TamperNative.logoutGoogle=async function(){
    try{await plugins.FirebaseAuthentication?.signOut();}catch(e){}
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
