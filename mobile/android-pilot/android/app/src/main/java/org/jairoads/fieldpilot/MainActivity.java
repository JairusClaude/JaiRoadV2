package org.jairoads.fieldpilot;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;

import androidx.webkit.WebViewAssetLoader;

public final class MainActivity extends Activity {
    private static final int FIELD_FILE = 491;
    private static final String PILOT_PATH = "/jairoads-android-pilot/";
    private static final String PILOT_PAGE = PILOT_PATH + "index.html";
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private LinearLayout layout;
    private static final String origin = "https://jairoads-dd-review-20261114.onrender.com";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(false);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        setContentView(layout);

        openPilot();
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }

        String url = web.getUrl();
        if ((origin + PILOT_PAGE).equals(url)) {
            handleLocalBack(false);
        } else if ((origin + PILOT_PAGE + "#field-reports").equals(url)) {
            handleLocalBack(true);
        } else {
            openPilot();
        }
    }

    private void handleLocalBack(boolean workspace) {
        web.evaluateJavascript(
                "window.dispatchEvent(new Event('jairoads-back', {cancelable: true}))",
                result -> {
                    if ("true".equals(result)) {
                        if (workspace) {
                            web.reload();
                        } else {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.evaluateJavascript("window.dispatchEvent(new Event('jairoads-resume'))", null);
        }
    }

    private void openPilot() {
        if (web == null) {
            String host = Uri.parse(origin).getHost();
            WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                    .setDomain(host)
                    .addPathHandler(PILOT_PATH, new WebViewAssetLoader.AssetsPathHandler(this))
                    .build();

            web = new WebView(this);
            web.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                    if (view.getUrl() == null || !view.getUrl().startsWith(origin + "/")) {
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
            web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + " JaiROADSField/0.3");
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
        web.loadUrl(origin + PILOT_PAGE);
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FIELD_FILE && chooser != null) {
            ValueCallback<Uri[]> pending = chooser;
            chooser = null;
            pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        }
    }

    @Override
    protected void onDestroy() {
        if (chooser != null) {
            chooser.onReceiveValue(null);
            chooser = null;
        }
        if (web != null) {
            layout.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
