package org.jairoads.fieldpilot;

import android.app.Activity;
import android.app.AlertDialog;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.webkit.WebViewAssetLoader;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String PILOT_PATH = "/jairoads-android-pilot/";
    private WebView web;
    private LinearLayout layout;
    private String origin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(false);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        setContentView(layout);

        LinearLayout toolbar = new LinearLayout(this);
        layout.addView(toolbar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        Button offline = new Button(this);
        offline.setText("Field reports");
        offline.setOnClickListener(view -> openPilot());
        toolbar.addView(offline);
        Button server = new Button(this);
        server.setText("Staging server");
        server.setOnClickListener(view -> chooseServer());
        toolbar.addView(server);

        origin = getPreferences(MODE_PRIVATE).getString("staging_origin", null);
        if (origin == null) {
            TextView instructions = new TextView(this);
            instructions.setText("Add a JaiROADS HTTPS staging URL to begin. This pilot uses a disposable database and staging test accounts.");
            instructions.setPadding(24, 24, 24, 24);
            layout.addView(instructions);
            chooseServer();
        } else {
            openPilot();
        }
    }

    private void chooseServer() {
        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("https://staging.example.gov.ph");
        input.setText(origin);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("JaiROADS staging server")
                .setMessage("Use the HTTPS origin of the staging application. Saved reports are isolated by server.")
                .setView(input)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Connect", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(view -> {
                    try {
                        String chosen = parseOrigin(input.getText().toString().trim());
                        if (web != null && !chosen.equals(origin)) {
                            layout.removeView(web);
                            web.destroy();
                            web = null;
                        }

                        origin = chosen;
                        getPreferences(MODE_PRIVATE).edit().putString("staging_origin", origin).apply();
                        if (layout.getChildCount() > 1 && web == null) {
                            layout.removeViewAt(1);
                        }
                        dialog.dismiss();
                        openPilot();
                    } catch (IllegalArgumentException error) {
                        input.setError(error.getMessage());
                    }
                }));
        dialog.show();
    }

    private static String parseOrigin(String value) {
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)
                    || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))) {
                throw new IllegalArgumentException("Enter an HTTPS origin without a path or port.");
            }
            return "https://" + host.toLowerCase(Locale.ROOT);
        } catch (URISyntaxException error) {
            throw new IllegalArgumentException("Enter a valid HTTPS staging URL.");
        }
    }

    private void openPilot() {
        if (origin == null) {
            chooseServer();
            return;
        }
        if (web == null) {
            String host = Uri.parse(origin).getHost();
            WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                    .setDomain(host)
                    .addPathHandler(PILOT_PATH, new WebViewAssetLoader.AssetsPathHandler(this))
                    .build();

            web = new WebView(this);
            web.setWebChromeClient(new WebChromeClient());
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setDomStorageEnabled(true);
            web.getSettings().setAllowFileAccess(false);
            web.getSettings().setAllowContentAccess(false);
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
            web.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    return loader.shouldInterceptRequest(request.getUrl());
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (!request.isForMainFrame()) {
                        return false;
                    }
                    Uri target = request.getUrl();

                    return !"https".equals(target.getScheme()) || !host.equalsIgnoreCase(target.getHost())
                            || (target.getPort() != -1 && target.getPort() != 443);
                }
            });
            layout.addView(web, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        }
        web.loadUrl(origin + PILOT_PATH + "index.html");
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            layout.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
