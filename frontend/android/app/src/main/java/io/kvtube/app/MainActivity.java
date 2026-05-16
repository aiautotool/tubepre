package io.kvtube.app;

import android.Manifest;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    private static final Rational VIDEO_ASPECT_RATIO = new Rational(16, 9);
    private static final int VOICE_SEARCH_PERMISSION_REQUEST = 4101;
    private SpeechRecognizer speechRecognizer;
    private boolean pendingVoiceSearch;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            webView.addJavascriptInterface(new VoiceSearchBridge(), "KVTubeAndroidVoice");
        }
    }

    @Override
    public void onDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != VOICE_SEARCH_PERMISSION_REQUEST) {
            return;
        }

        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted && pendingVoiceSearch) {
            pendingVoiceSearch = false;
            startNativeVoiceSearch();
        } else {
            pendingVoiceSearch = false;
            sendVoiceSearchError("Không có quyền dùng micro.");
        }
    }

    private void requestVoiceSearch() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingVoiceSearch = true;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, VOICE_SEARCH_PERMISSION_REQUEST);
            return;
        }

        startNativeVoiceSearch();
    }

    private void startNativeVoiceSearch() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendVoiceSearchError("Thiết bị chưa hỗ trợ nhận diện giọng nói.");
            return;
        }

        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                sendVoiceSearchListening(true);
            }

            @Override
            public void onBeginningOfSpeech() {}

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {
                sendVoiceSearchListening(false);
            }

            @Override
            public void onError(int error) {
                sendVoiceSearchListening(false);
                sendVoiceSearchError("Không nghe được giọng nói. Vui lòng thử lại.");
            }

            @Override
            public void onResults(Bundle results) {
                sendVoiceSearchListening(false);
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    sendVoiceSearchResult(matches.get(0));
                } else {
                    sendVoiceSearchError("Không nhận diện được nội dung.");
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {}

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "vi-VN");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "vi-VN");
        intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "vi-VN");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Tìm kiếm bằng giọng nói");
        speechRecognizer.startListening(intent);
    }

    private void sendVoiceSearchListening(boolean listening) {
        evaluateVoiceSearchJavascript(
            "window.dispatchEvent(new CustomEvent('kvtube-voice-listening',{detail:{listening:" + listening + "}}));"
        );
    }

    private void sendVoiceSearchResult(String transcript) {
        evaluateVoiceSearchJavascript(
            "window.dispatchEvent(new CustomEvent('kvtube-voice-result',{detail:{transcript:" + quoteForJavascript(transcript) + "}}));"
        );
    }

    private void sendVoiceSearchError(String message) {
        evaluateVoiceSearchJavascript(
            "window.dispatchEvent(new CustomEvent('kvtube-voice-error',{detail:{message:" + quoteForJavascript(message) + "}}));"
        );
    }

    private void evaluateVoiceSearchJavascript(String script) {
        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) {
            return;
        }
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private String quoteForJavascript(String value) {
        String escaped = value == null ? "" : value
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
        return "'" + escaped + "'";
    }

    @Override
    public void onUserLeaveHint() {
        if (shouldEnterPictureInPicture()) {
            enterVideoPictureInPicture();
            return;
        }

        super.onUserLeaveHint();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        setWebPictureInPictureMode(isInPictureInPictureMode);
    }

    private boolean shouldEnterPictureInPicture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || isInPictureInPictureMode()) {
            return false;
        }

        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        String currentUrl = webView != null ? webView.getUrl() : null;
        return currentUrl != null && currentUrl.contains("/watch");
    }

    private void enterVideoPictureInPicture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        PictureInPictureParams.Builder paramsBuilder = new PictureInPictureParams.Builder()
            .setAspectRatio(VIDEO_ASPECT_RATIO);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            paramsBuilder.setAutoEnterEnabled(true);
        }

        enterPictureInPictureMode(paramsBuilder.build());
    }

    private void setWebPictureInPictureMode(boolean enabled) {
        Bridge bridge = getBridge();
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView == null) {
            return;
        }

        String action = enabled ? "add" : "remove";
        webView.evaluateJavascript(
            "document.documentElement.classList." + action + "('android-pip-mode');",
            null
        );
    }

    private class VoiceSearchBridge {
        @JavascriptInterface
        public void startVoiceSearch() {
            runOnUiThread(() -> requestVoiceSearch());
        }
    }
}
