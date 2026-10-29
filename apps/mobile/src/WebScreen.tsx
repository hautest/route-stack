import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { INJECTED_BEFORE_CONTENT } from './injected';
import { log, LOG_PATH } from './log';

const OS_VERSION =
  Platform.OS === 'android'
    ? `Android ${Platform.constants.Release} (API ${Platform.Version})`
    : `iOS ${Platform.Version}`;

type Env = { ua?: string; navigationApi?: boolean };

export function WebScreen({
  url,
  backForwardGestures,
  onClose,
}: {
  url: string;
  backForwardGestures: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const ref = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [webKey, setWebKey] = useState(0);
  const [startUrl, setStartUrl] = useState(url);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [env, setEnv] = useState<Env>({});

  useEffect(() => {
    log({ type: 'session', os: OS_VERSION, url, backForwardGestures });
  }, [url, backForwardGestures]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // The web app gets the back as a plain history.back(), same as the design's bridge.
      if (canGoBack.current) ref.current?.injectJavaScript('history.back(); true;');
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      msg = { type: 'raw', data: e.nativeEvent.data };
    }
    if (msg.type === 'env') {
      setEnv({ ua: msg.ua as string, navigationApi: msg.navigationApi as boolean });
    }
    log(msg);
  };

  const showInfo = () =>
    Alert.alert(
      'Session',
      [
        OS_VERSION,
        `UA: ${env.ua ?? '-'}`,
        `window.navigation: ${env.navigationApi ?? '-'}`,
        `back/forward gestures: ${backForwardGestures}`,
        `URL: ${currentUrl}`,
        `log: ${LOG_PATH}`,
      ].join('\n\n'),
    );

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
          <Text style={styles.button}>✕</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {currentUrl}
        </Text>
        <Pressable onPress={showInfo} hitSlop={8} accessibilityLabel="Info">
          <Text style={styles.button}>ⓘ</Text>
        </Pressable>
        <Pressable
          onPress={() => ref.current?.reload()}
          hitSlop={8}
          accessibilityLabel="Reload"
        >
          <Text style={styles.button}>↻</Text>
        </Pressable>
      </View>
      <WebView
        key={webKey}
        ref={ref}
        source={{ uri: startUrl }}
        style={styles.web}
        injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_CONTENT}
        onMessage={onMessage}
        onNavigationStateChange={s => {
          canGoBack.current = s.canGoBack;
          setCurrentUrl(s.url);
        }}
        // '*' so no URL is handed to Linking (the default for non-http origins); everything
        // http(s) stays in this WebView, other schemes (tel:, mailto:, intent:) are dropped.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={r => {
          const ok = /^(https?|about|data|blob):/.test(r.url);
          if (!ok) log({ type: 'blocked-navigation', url: r.url });
          return ok;
        }}
        webviewDebuggingEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // iOS
        allowsBackForwardNavigationGestures={backForwardGestures}
        allowsLinkPreview={false}
        // Fixed so runs are comparable; rubber-banding also interferes with edge-swipe tests.
        bounces={false}
        onContentProcessDidTerminate={() => {
          log({ type: 'content-process-terminated', url: currentUrl });
          ref.current?.reload();
        }}
        // Android
        setSupportMultipleWindows={false}
        onRenderProcessGone={e => {
          log({ type: 'render-process-gone', didCrash: e.nativeEvent.didCrash, url: currentUrl });
          // The old WebView instance is unusable after its renderer dies; remount instead of reload().
          setStartUrl(currentUrl);
          setWebKey(k => k + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#f2f2f2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  button: { fontSize: 20, color: '#007aff', paddingTop: 8 },
  title: { flex: 1, fontSize: 13, color: '#333', paddingTop: 8 },
  web: { flex: 1 },
});
