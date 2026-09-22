package com.tamper.rewards;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Registro explícito: garantiza que Firebase Authentication forme parte
        // del Bridge aun si falla la carga automática de capacitor.plugins.json.
        registerPlugin(FirebaseAuthenticationPlugin.class);
        // Puente minimo: obtiene solo el ID token y evita que credenciales de
        // Google que Tamper no usa bloqueen un acceso valido.
        registerPlugin(TamperGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
