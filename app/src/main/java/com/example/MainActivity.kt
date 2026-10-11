package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      MyApplicationTheme {
        Surface(
          modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
          color = MaterialTheme.colorScheme.background
        ) {
          MazeMintGameScreen(onExitApp = { finish() })
        }
      }
    }
  }
}

class AndroidBridge(
  private val context: Context,
  private val webView: WebView?
) {
  @JavascriptInterface
  fun vibrate(durationMs: Long) {
    try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vibratorManager?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }

      val ms = durationMs.coerceIn(10L, 500L)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
      } else {
        @Suppress("DEPRECATION")
        vibrator?.vibrate(ms)
      }
    } catch (_: Exception) {
      // Gracefully ignore on devices without vibration hardware
    }
  }

  @JavascriptInterface
  fun showToast(message: String) {
    Handler(Looper.getMainLooper()).post {
      Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }
  }

  @JavascriptInterface
  fun isNativeApp(): Boolean = true
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MazeMintGameScreen(onExitApp: () -> Unit) {
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }

  BackHandler {
    val currentWebView = webViewInstance
    if (currentWebView != null) {
      currentWebView.evaluateJavascript(
        "if (typeof window.onNativeBackPressed === 'function') { window.onNativeBackPressed(); } else { false; }"
      ) { result ->
        if (result != "true") {
          if (currentWebView.canGoBack()) {
            currentWebView.goBack()
          } else {
            onExitApp()
          }
        }
      }
    } else {
      onExitApp()
    }
  }

  AndroidView(
    modifier = Modifier.fillMaxSize(),
    factory = { context ->
      WebView(context).apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )

        try {
          setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        } catch (_: Exception) {}

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          allowFileAccess = true
          useWideViewPort = true
          loadWithOverviewMode = true
          setSupportZoom(false)
          builtInZoomControls = false
          displayZoomControls = false
          cacheMode = WebSettings.LOAD_DEFAULT
          mediaPlaybackRequiresUserGesture = false
        }

        addJavascriptInterface(AndroidBridge(context, this), "AndroidBridge")

        webChromeClient = WebChromeClient()
        webViewClient = object : WebViewClient() {
          override fun onReceivedError(
            view: WebView?,
            request: WebResourceRequest?,
            error: WebResourceError?
          ) {
            super.onReceivedError(view, request, error)
          }
        }

        loadUrl("file:///android_asset/index.html")
        webViewInstance = this
      }
    },
    update = { webView ->
      webViewInstance = webView
    }
  )

  DisposableEffect(Unit) {
    onDispose {
      webViewInstance?.destroy()
    }
  }
}
