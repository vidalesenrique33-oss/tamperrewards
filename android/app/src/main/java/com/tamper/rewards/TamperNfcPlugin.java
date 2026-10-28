package com.tamper.rewards;

import android.content.Intent;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.FormatException;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.TagLostException;
import android.nfc.tech.Ndef;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

/** Reader-only pilot. No writes to tags, network calls, loyalty credits, or payload logging. */
@CapacitorPlugin(name = "TamperNfc")
public class TamperNfcPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean processing = new AtomicBoolean(false);
    private NfcAdapter adapter;
    private PluginCall pending;
    private Runnable timeout;
    private long generation = 0;
    private boolean resumed = false;
    private static final long TIMEOUT_MS = 30000;

    @Override public void load() {
        adapter = NfcAdapter.getDefaultAdapter(getContext());
    }

    @PluginMethod public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod public void openSettings(PluginCall call) {
        main.post(() -> {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_NFC_SETTINGS));
                call.resolve();
            } catch (Exception error) {
                call.reject("Abre NFC desde los ajustes del teléfono.", "NFC_SETTINGS");
            }
        });
    }

    @PluginMethod public void startScan(PluginCall call) {
        main.post(() -> {
            if (adapter == null) { call.reject("Este teléfono no tiene lector NFC.", "NFC_UNSUPPORTED"); return; }
            if (!adapter.isEnabled()) { call.reject("Activa NFC en los ajustes del teléfono.", "NFC_DISABLED"); return; }
            if (!resumed || getActivity().isFinishing()) { call.reject("Vuelve a Tamper para leer la etiqueta.", "NFC_INTERRUPTED"); return; }
            if (pending != null) { call.reject("Ya hay una lectura en curso.", "NFC_BUSY"); return; }
            pending = call;
            processing.set(false);
            final long request = ++generation;
            timeout = () -> fail(request, "No se detectó una etiqueta. Acércala y vuelve a intentar.", "NFC_TIMEOUT");
            main.postDelayed(timeout, TIMEOUT_MS);
            Bundle options = new Bundle();
            options.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 150);
            int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B
                | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V
                | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS;
            try {
                adapter.enableReaderMode(getActivity(), tag -> readTag(tag, request), flags, options);
            } catch (Exception error) {
                fail(request, "No se pudo iniciar el lector. Revisa que NFC esté activado.", "NFC_START_FAILED");
            }
        });
    }

    private void readTag(Tag tag, long request) {
        if (!processing.compareAndSet(false, true)) return;
        Ndef ndef = Ndef.get(tag);
        try {
            JSObject result = new JSObject();
            result.put("ndef", ndef != null);
            result.put("pilot", true);
            result.put("rewardGranted", false);
            JSArray kinds = new JSArray();
            int count = 0;
            if (ndef != null) {
                ndef.connect();
                NdefMessage message = ndef.getNdefMessage();
                if (message != null) {
                    if (message.toByteArray().length > 4096) {
                        main.post(() -> fail(request, "La etiqueta contiene más datos de los admitidos en esta prueba.", "NFC_TOO_LARGE"));
                        return;
                    }
                    NdefRecord[] records = message.getRecords();
                    count = records.length;
                    for (int i = 0; i < Math.min(records.length, 8); i++) {
                        NdefRecord record = records[i];
                        if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_URI)) kinds.put("enlace");
                        else if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) kinds.put("texto");
                        else kinds.put("otro");
                    }
                }
            }
            result.put("recordCount", count);
            result.put("recordKinds", kinds);
            // Never return UID, raw URLs, text, authentication data or tag contents to the page.
            main.post(() -> {
                if (pending == null || request != generation) return;
                PluginCall call = pending;
                cleanup();
                call.resolve(result);
            });
        } catch (TagLostException error) {
            main.post(() -> fail(request, "La etiqueta se alejó antes de terminar. Mantenla cerca un momento.", "NFC_TAG_LOST"));
        } catch (IOException | FormatException | RuntimeException error) {
            main.post(() -> fail(request, "No se pudo leer esta etiqueta. Acércala de nuevo o utiliza tu QR.", "NFC_READ_FAILED"));
        } finally {
            if (ndef != null) { try { ndef.close(); } catch (IOException ignored) {} }
        }
    }

    private void cleanup() {
        ++generation;
        if (timeout != null) main.removeCallbacks(timeout);
        timeout = null;
        pending = null;
        // Retain the processing lock until a new session explicitly resets it.
        if (adapter != null) {
            try { adapter.disableReaderMode(getActivity()); } catch (RuntimeException ignored) {}
        }
    }

    private void fail(long request, String message, String code) {
        if (pending == null || request != generation) return;
        PluginCall call = pending;
        cleanup();
        call.reject(message, code);
    }

    @PluginMethod public void stopScan(PluginCall call) {
        main.post(() -> {
            if (pending != null) fail(generation, "Lectura cancelada.", "NFC_CANCELLED");
            else cleanup();
            call.resolve();
        });
    }

    @Override protected void handleOnResume() { resumed = true; }
    @Override protected void handleOnPause() {
        resumed = false;
        if (pending != null) fail(generation, "La lectura se detuvo al salir de Tamper.", "NFC_INTERRUPTED");
    }
    @Override protected void handleOnDestroy() {
        resumed = false;
        if (pending != null) fail(generation, "La lectura se cerró.", "NFC_INTERRUPTED");
        main.removeCallbacksAndMessages(null);
    }
}
