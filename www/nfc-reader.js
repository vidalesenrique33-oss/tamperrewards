(function () {
  'use strict';
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== 'android') return;
  if (window.TamperNfcPilot) return;
  const plugin = cap.registerPlugin?.('TamperNfc');
  const call = (method, options = {}) => typeof cap.nativePromise === 'function'
    ? cap.nativePromise('TamperNfc', method, options)
    : plugin?.[method] ? plugin[method](options) : Promise.reject(Object.assign(new Error('Lector no disponible.'), {code:'UNIMPLEMENTED'}));
  const icon = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M18 6h12v7c0 4-3 6-3 10v4h-6v-4c0-4-3-6-3-10V6Z" fill="currentColor" opacity=".24"/><path d="M18 6h12v7c0 4-3 6-3 10v4h-6v-4c0-4-3-6-3-10V6ZM13 29h22l3 10H10l3-10ZM7 43h34" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/><path class="nfc-wave" d="M36 10c4 3 4 7 0 10M41 6c7 6 7 12 0 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  let dialog, title, message, status, retry, settings, opener;
  let operation = 0, scanning = false, lastOutcome = 'idle';
  let closeTask = Promise.resolve();
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'tamper-nfc-dialog';
    dialog.className = 'tnfc-dialog';
    dialog.setAttribute('aria-labelledby','tnfc-title');
    dialog.setAttribute('aria-describedby','tnfc-message');
    dialog.innerHTML = '<div class="tnfc-top"><span>TAMPER · SELLO NFC</span><button type="button" data-nfc="close" aria-label="Cerrar lector NFC">×</button></div><div class="tnfc-art">'+icon+'<span class="tnfc-orbit" aria-hidden="true"></span></div><p class="tnfc-state" role="status" aria-live="polite"></p><h2 id="tnfc-title"></h2><p id="tnfc-message"></p><p class="tnfc-pilot">Prueba del lector · Acreditación de sellos pendiente</p><div class="tnfc-actions"><button type="button" data-nfc="retry" class="tnfc-primary">Volver a leer</button><button type="button" data-nfc="settings" class="tnfc-primary" hidden>Activar NFC</button><button type="button" data-nfc="qr" class="tnfc-secondary">Usar mi QR</button></div>';
    document.body.append(dialog);
    title = dialog.querySelector('h2'); message = dialog.querySelector('#tnfc-message');
    status = dialog.querySelector('.tnfc-state'); retry = dialog.querySelector('[data-nfc="retry"]'); settings = dialog.querySelector('[data-nfc="settings"]');
    dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
    dialog.addEventListener('click',event => {
      const action = event.target.closest('[data-nfc]')?.dataset.nfc;
      if (action === 'close') close();
      if (action === 'retry') void scan();
      if (action === 'settings') void openSettings();
      if (action === 'qr') openQr();
    });
    dialog.addEventListener('close',() => { void stop(); opener?.isConnected && opener.focus({preventScroll:true}); });
  }
  function present(outcome, heading, text, label) {
    lastOutcome = outcome;
    dialog.dataset.state = outcome;
    title.textContent = heading; message.textContent = text; status.textContent = label;
    retry.hidden = ['scanning','checking','unsupported','disabled'].includes(outcome);
    settings.hidden = outcome !== 'disabled';
  }
  function errorText(error) {
    const map = {
      NFC_TIMEOUT:['No alcanzamos a leerla','Acerca la etiqueta a la parte trasera del teléfono y mantenla quieta un momento.'],
      NFC_TAG_LOST:['Un momento más','La etiqueta se alejó antes de terminar. Inténtalo manteniéndola cerca.'],
      NFC_INTERRUPTED:['La lectura se pausó','Vuelve a leer cuando estés listo. El lector se detiene al salir de Tamper.'],
      NFC_TOO_LARGE:['Esta etiqueta necesita otra lectura','Su contenido supera el límite de esta prueba. Puedes continuar con tu QR.'],
      NFC_BUSY:['Hay una lectura en curso','Cierra el lector y vuelve a abrirlo.'],
      UNIMPLEMENTED:['Actualiza la app','Esta instalación todavía no incluye el lector NFC nativo. Tu QR sigue disponible.'],
    };
    return map[error?.code] || ['No se pudo leer','Acerca la etiqueta de nuevo. También puedes identificarte con tu QR.'];
  }
  async function stop() {
    ++operation; scanning = false;
    closeTask = call('stopScan').catch(() => {});
    await closeTask;
  }
  async function scan() {
    if (scanning || !dialog?.open) return;
    scanning = true;
    const request = ++operation;
    present('checking','Preparando el lector','Un momento…','Revisando NFC');
    try {
      await closeTask;
      const availability = await call('getStatus');
      if (request !== operation || !dialog.open) return;
      if (!availability.supported) { present('unsupported','Continúa con tu QR','Este teléfono no dispone de lector NFC. Puedes seguir usando Tamper con tu código.','QR disponible');return; }
      if (!availability.enabled) { present('disabled','Enciende NFC','Actívalo en los ajustes del teléfono. Después vuelve aquí para leer el sello.','NFC está apagado');return; }
      present('scanning','Acerca el tamper','Acerca la etiqueta NFC a la parte trasera del teléfono. No necesitas presionar la pantalla.','Buscando etiqueta');
      const result = await call('startScan');
      if (request !== operation || !dialog.open) return;
      const description = result.ndef
        ? 'El teléfono pudo leer la etiqueta NFC. Esta prueba comprueba el lector; todavía no acredita sellos.'
        : 'El teléfono detectó una etiqueta NFC sin contenido NDEF disponible. La lectura no acredita sellos.';
      present('read','Etiqueta leída',description,result.ndef ? 'Lectura completada' : 'Etiqueta detectada');
    } catch (error) {
      if (request !== operation || !dialog.open || error?.code === 'NFC_CANCELLED') return;
      if (error?.code === 'NFC_DISABLED') present('disabled','Enciende NFC','Actívalo en los ajustes y vuelve a intentarlo.','NFC está apagado');
      else if (error?.code === 'NFC_UNSUPPORTED') present('unsupported','Continúa con tu QR','Este teléfono no dispone de lector NFC.','QR disponible');
      else {const [heading,text] = errorText(error);present('error',heading,text,'Puedes volver a intentar');}
    } finally { if (request === operation) scanning = false; }
  }
  function open(trigger) {
    ensureDialog();
    if (dialog.open) return;
    opener = trigger || document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open',''); dialog.classList.add('tnfc-fallback'); }
    dialog.querySelector('[data-nfc="close"]').focus({preventScroll:true});
    void scan();
  }
  function close() {
    void stop();
    if (dialog?.open) {
      if (typeof dialog.close === 'function') dialog.close(); else {dialog.removeAttribute('open');opener?.focus();}
    }
  }
  function openQr() {
    const qr = document.querySelector('button[aria-label="Mostrar mi código QR"]');
    if (qr) { close(); qr.click(); }
    else {
      ensureDialog();
      if (!dialog.open) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open',''); }
      void stop();present('error','Tu QR está en la barra inferior','Cierra esta ventana y toca Mi QR para identificarte.','QR disponible');
    }
  }
  async function openSettings() {
    try { await call('openSettings'); present('error','Cuando vuelvas, toca volver a leer','El lector comenzará cuando lo actives aquí.','Revisa tus ajustes'); }
    catch { present('error','Abre los ajustes del teléfono','Busca NFC, actívalo y vuelve a Tamper.','Activación manual'); }
  }
  function mount() {
    if (!window.document?.body) return;
    if (document.getElementById('tamper-nfc-entry')) return;
    const header = document.querySelector('.clean-home .clean-topbar');
    if (!header) return;
    const entry = document.createElement('section');
    entry.id = 'tamper-nfc-entry';entry.className = 'tnfc-entry';
    entry.setAttribute('aria-label','Recibir un sello con NFC');
    entry.innerHTML = '<button type="button" class="tnfc-entry-main">'+icon+'<span><strong>Recibir sello</strong><small>Acerca el tamper a tu celular</small></span><span aria-hidden="true">↗</span></button><div class="tnfc-entry-bottom"><span>Prueba de lectura NFC</span><button type="button" class="tnfc-entry-qr">Usar mi QR</button></div>';
    header.after(entry);
    entry.querySelector('.tnfc-entry-main').addEventListener('click',event => open(event.currentTarget));
    entry.querySelector('.tnfc-entry-qr').addEventListener('click',openQr);
  }
  const observer = new MutationObserver(mutations => {
    if (!window.document?.body) return;
    if (mutations.some(m => m.addedNodes.length || m.removedNodes.length)) {
      mount();
      // Authentication removes the home node. Stop any in-flight read immediately.
      if (dialog?.open && !document.getElementById('tamper-nfc-entry')) close();
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',() => {observer.disconnect();void stop();},{once:true});
  document.addEventListener('visibilitychange',() => {
    if (document.hidden && dialog?.open && scanning) {
      void stop();present('error','La lectura se pausó','Toca volver a leer cuando regreses a Tamper.','Lector detenido');
    }
  });
  window.addEventListener('tamper:native-back',event => {if(dialog?.open){event.detail.handled=true;close();}});
  document.addEventListener('keydown',event => {
    if (!dialog?.open || !dialog.classList.contains('tnfc-fallback')) return;
    if (event.key === 'Escape') {event.preventDefault();close();}
    if (event.key === 'Tab') {const controls=[...dialog.querySelectorAll('button')].filter(e=>!e.hidden);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  window.TamperNfcPilot = Object.freeze({open,close,get state(){return lastOutcome;},version:'1.0.5-nfc-pilot'});
  mount();
})();
