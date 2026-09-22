package com.tamper.rewards;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

/**
 * Inicio de sesion de Google minimo para Tamper Rewards.
 *
 * Solo solicita el ID token que Firebase Web necesita. No solicita access token
 * ni server auth code: esas credenciales extra hacian que el complemento
 * generico abortara un acceso que ya habia obtenido correctamente el ID token.
 */
@CapacitorPlugin(name = "TamperGoogleAuth")
public class TamperGoogleAuthPlugin extends Plugin {

    private GoogleSignInClient googleSignInClient;

    @PluginMethod
    public void signIn(PluginCall call) {
        String webClientId = getContext().getString(R.string.default_web_client_id);
        if (webClientId == null || webClientId.isBlank() || "WILL_BE_OVERRIDDEN".equals(webClientId)) {
            call.reject("Android no encontro default_web_client_id", "MISSING_WEB_CLIENT_ID");
            return;
        }

        GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build();

        googleSignInClient = GoogleSignIn.getClient(getActivity(), options);
        startActivityForResult(call, googleSignInClient.getSignInIntent(), "handleSignInResult");
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            return;
        }

        Intent data = activityResult.getData();
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account.getIdToken();
            if (idToken == null || idToken.isBlank()) {
                call.reject("Google no devolvio el ID token", "MISSING_ID_TOKEN");
                return;
            }

            JSObject result = new JSObject();
            result.put("idToken", idToken);
            result.put("email", account.getEmail());
            call.resolve(result);
        } catch (ApiException exception) {
            int statusCode = exception.getStatusCode();
            call.reject(
                "Google Sign-In fallo con codigo Android " + statusCode,
                "GOOGLE_STATUS_" + statusCode,
                exception
            );
        } catch (Exception exception) {
            call.reject("Google Sign-In fallo: " + exception.getMessage(), "GOOGLE_SIGN_IN_FAILED", exception);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        if (googleSignInClient == null) {
            String webClientId = getContext().getString(R.string.default_web_client_id);
            GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(webClientId)
                .requestEmail()
                .build();
            googleSignInClient = GoogleSignIn.getClient(getActivity(), options);
        }

        googleSignInClient.signOut().addOnCompleteListener(task -> call.resolve());
    }
}
