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
    private static final String origin = "https://jairoads-android-pilot-lvin.onrender.com";

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
        if (web != null && !(origin + PILOT_PATH + "index.html").equals(web.getUrl())) {
            openPilot();
        } else {
            super.onBackPressed();
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
            web.setWebChromeClient(new WebChromeClient());
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setDomStorageEnabled(true);
            web.getSettings().setAllowFileAccess(false);
            web.getSettings().setAllowContentAccess(false);
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
            web.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    if (url.equals(origin + "/workspace/dashboard") || url.equals(origin + "/dashboard")) {
                        openPilot();
                    }
                }

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
