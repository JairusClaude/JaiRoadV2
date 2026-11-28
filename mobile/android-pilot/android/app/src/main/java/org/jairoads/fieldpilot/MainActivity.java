package org.jairoads.fieldpilot;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.util.Collections;

import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int FIELD_FILE = 491;
    private static final int FIELD_EXPORT = 492;
    private byte[] exportBytes;
    private static final String ORIGIN = "https://jairoads-dd-review-20261114.onrender.com";
    private static final String HOST = "jairoads-dd-review-20261114.onrender.com";
    private static final String ASSET_PATH = "/jairoads-android-pilot/";
    private static final String SHELL_URL = ORIGIN + ASSET_PATH + "index.html";
    private static final String FIELD_URL = SHELL_URL + "#field-reports";
    private static final String DASHBOARD_URL = ORIGIN + "/dashboard";

    private FrameLayout layout;
    private WebView shell;
    private WebView hosted;
    private ValueCallback<Uri[]> chooser;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean cached;
    private boolean onlineRequested;
    private boolean hostedReady;
    private boolean hostedLoading;
    private boolean hostedFailed;
    private String lastHostedPage = DASHBOARD_URL;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(false);
        layout = new FrameLayout(this);
        setContentView(layout);

        shell = createView(true);
        layout.addView(shell, new FrameLayout.LayoutParams(-1, -1));
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(shell, "JaiRoadsHost", Collections.singleton(ORIGIN),
                    (view, message, source, mainFrame, reply) -> {
                        if (!mainFrame || !trusted(source) || !isShell(view.getUrl())) {
                            return;
                        }
                        if (message.getType() == androidx.webkit.WebMessageCompat.TYPE_STRING) {
                            handleMode(message.getData());
                        }
                    });
        }
        shell.loadUrl(SHELL_URL);

        connectivity = getSystemService(ConnectivityManager.class);
        if (connectivity != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    runOnUiThread(MainActivity.this::networkChanged);
                }

                @Override
                public void onLost(Network network) {
                    runOnUiThread(MainActivity.this::networkChanged);
                }

                @Override
                public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                    runOnUiThread(MainActivity.this::networkChanged);
                }
            };
            connectivity.registerDefaultNetworkCallback(networkCallback);
        }
    }

    private boolean hasLink() {
        if (connectivity == null) {
            return true;
        }
        NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void networkChanged() {
        if (shell == null) {
            return;
        }
        if (!hasLink()) {
            showLocal();
            signal("jairoads-link-down");
        } else {
            signal("jairoads-link-up");
            if (onlineRequested && !cached) {
                showOnline();
            }
        }
    }

    private void handleMode(String mode) {
        if (mode != null && mode.startsWith("export-file:")) {
            exportFile(mode.substring("export-file:".length()));
        } else if ("cache-ready".equals(mode)) {
            cached = true;
        } else if ("show-online".equals(mode)) {
            onlineRequested = true;
            showOnline();
        } else if ("show-local".equals(mode)) {
            onlineRequested = false;
            showLocal();
        } else if ("lock".equals(mode)) {
            resetViews();
        }
    }

    private void exportFile(String payload) {
        if (!cached || exportBytes != null || payload.length() > 6 * 1024 * 1024) return;
        try {
            JSONObject file = new JSONObject(payload);
            String name = file.getString("name").replaceAll("[/\\\\\\p{Cntrl}]", "_");
            String data = file.getString("data");
            int comma = data.indexOf(',');
            if (name.isEmpty() || name.length() > 255 || comma < 0 || !data.startsWith("data:")) return;
            String type = data.substring(5, comma);
            if (!type.endsWith(";base64")) return;
            type = type.substring(0, type.length() - 7);
            if (!type.equals("application/pdf") && !type.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                    && !type.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    && !type.equals("application/vnd.openxmlformats-officedocument.presentationml.presentation")
                    && !type.equals("image/jpeg") && !type.equals("image/png") && !type.equals("image/webp")) return;
            byte[] bytes = android.util.Base64.decode(data.substring(comma + 1), android.util.Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > 4 * 1024 * 1024) return;
            exportBytes = bytes;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(type);
            intent.putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(intent, FIELD_EXPORT);
        } catch (Exception error) {
            exportBytes = null;
            android.widget.Toast.makeText(this, "Could not open the local file.", android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    private void signal(String name) {
        if (shell != null) {
            shell.evaluateJavascript("window.dispatchEvent(new Event('" + name + "'))", null);
        }
    }

    private void showLocal() {
        if (cached) {
            if (hosted != null) {
                hosted.setVisibility(View.INVISIBLE);
            }
            shell.setVisibility(View.VISIBLE);
            String current = hosted == null ? null : hosted.getUrl();
            String path = current == null ? "" : Uri.parse(current).getPath();
            shell.evaluateJavascript("window.dispatchEvent(new CustomEvent('jairoads-local-shown', {detail:"
                    + JSONObject.quote(path == null ? "" : path) + "}))", null);
        }
    }

    private void showOnline() {
        if (!hasLink()) {
            showLocal();
            return;
        }
        if (hosted == null) {
            hosted = createView(false);
            hosted.setVisibility(View.INVISIBLE);
            layout.addView(hosted, new FrameLayout.LayoutParams(-1, -1));
        }
        if (hostedReady && !hostedFailed) {
            hosted.setVisibility(View.VISIBLE);
            shell.setVisibility(View.INVISIBLE);
            signal("jairoads-hosted-shown");
        } else if (!hostedLoading) {
            hostedFailed = false;
            hostedLoading = true;
            hosted.loadUrl(lastHostedPage);
        }
    }

    private void resetViews() {
        cached = false;
        exportBytes = null;
        onlineRequested = false;
        hostedReady = false;
        hostedFailed = false;
        hostedLoading = false;
        lastHostedPage = DASHBOARD_URL;
        shell.setVisibility(View.VISIBLE);
        if (hosted != null) {
            layout.removeView(hosted);
            hosted.destroy();
            hosted = null;
        }
    }

    private static boolean trusted(Uri url) {
        return "https".equals(url.getScheme()) && HOST.equalsIgnoreCase(url.getHost())
                && (url.getPort() == -1 || url.getPort() == 443);
    }

    private static boolean isShell(String url) {
        return SHELL_URL.equals(url) || FIELD_URL.equals(url);
    }

    private WebView createView(boolean local) {
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler(ASSET_PATH, new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        WebView view = new WebView(this);
        view.getSettings().setUserAgentString(view.getSettings().getUserAgentString() + " JaiROADSField/0.4");
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView web, ValueCallback<Uri[]> callback, FileChooserParams params) {
                String url = web.getUrl();
                if (url == null || !trusted(Uri.parse(url))) {
                    return false;
                }
                if (chooser != null) {
                    chooser.onReceiveValue(null);
                }
                chooser = callback;
                try {
                    startActivityForResult(params.createIntent(), FIELD_FILE);
                } catch (ActivityNotFoundException error) {
                    chooser.onReceiveValue(null);
                    chooser = null;
                }
                return true;
            }
        });
        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView web, WebResourceRequest request) {
                return local ? loader.shouldInterceptRequest(request.getUrl()) : null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView web, WebResourceRequest request) {
                return request.isForMainFrame() && !trusted(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView web, String url) {
                if (local || web != hosted || hostedFailed || !trusted(Uri.parse(url))) {
                    return;
                }
                hostedLoading = false;
                if ("/login".equals(Uri.parse(url).getPath())) {
                    if (cached && !hasLink()) {
                        showLocal();
                        return;
                    }
                    // A hosted sign-out or expired session returns to the app's sign-in.
                    layout.post(() -> {
                        if (web == hosted && shell != null) {
                            resetViews();
                            shell.loadUrl(SHELL_URL);
                        }
                    });
                    return;
                }
                hostedReady = true;
                lastHostedPage = url;
                if (onlineRequested && hasLink()) {
                    showOnline();
                }
            }

            @Override
            public void onReceivedError(WebView web, WebResourceRequest request, WebResourceError error) {
                if (!local && web == hosted && request.isForMainFrame()) {
                    hostedError();
                }
            }

            @Override
            public void onReceivedHttpError(WebView web, WebResourceRequest request, WebResourceResponse response) {
                if (!local && web == hosted && request.isForMainFrame() && response.getStatusCode() >= 500) {
                    hostedError();
                }
            }
        });
        return view;
    }

    private void hostedError() {
        hostedFailed = true;
        hostedReady = false;
        hostedLoading = false;
        showLocal();
        signal("jairoads-hosted-error");
    }

    @Override
    public void onBackPressed() {
        if (hosted != null && hosted.getVisibility() == View.VISIBLE) {
            if (hosted.canGoBack()) {
                hosted.goBack();
            } else {
                super.onBackPressed();
            }
            return;
        }
        if (shell == null) {
            super.onBackPressed();
            return;
        }
        shell.evaluateJavascript("window.dispatchEvent(new Event('jairoads-back', {cancelable: true}))",
                result -> {
                    if ("true".equals(result)) {
                        if (cached) {
                            resetViews();
                            shell.loadUrl(SHELL_URL);
                        } else {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onResume() {
        super.onResume();
        networkChanged();
        signal("jairoads-resume");
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FIELD_EXPORT) {
            byte[] bytes = exportBytes;
            exportBytes = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (java.io.OutputStream out = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (out == null) throw new java.io.IOException("File unavailable");
                    out.write(bytes);
                    android.widget.Toast.makeText(this, "Local file saved.", android.widget.Toast.LENGTH_SHORT).show();
                } catch (Exception error) {
                    android.widget.Toast.makeText(this, "Could not save the exported copy.", android.widget.Toast.LENGTH_SHORT).show();
                }
            }
        } else if (request == FIELD_FILE && chooser != null) {
            ValueCallback<Uri[]> pending = chooser;
            chooser = null;
            pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        }
    }

    @Override
    protected void onDestroy() {
        if (networkCallback != null) {
            connectivity.unregisterNetworkCallback(networkCallback);
        }
        if (chooser != null) {
            chooser.onReceiveValue(null);
            chooser = null;
        }
        if (shell != null) {
            resetViews();
            layout.removeView(shell);
            shell.destroy();
            shell = null;
        }
        super.onDestroy();
    }
}
