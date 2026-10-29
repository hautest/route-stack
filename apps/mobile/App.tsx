import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  DocumentDirectoryPath,
  readFile,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import defaultHost from './src/defaultHost.json';
import { LOG_PATH, setLogServer } from './src/log';
import { WebScreen } from './src/WebScreen';

const APPS = [
  ['next', 3100],
  ['react-router-spa', 3101],
  ['react-router-ssr', 3102],
  ['tanstack-router', 3103],
  ['tanstack-start', 3104],
  ['plain', 3105],
] as const;

const SETTINGS_PATH = `${DocumentDirectoryPath}/settings.json`;

// The Android emulator reaches the Mac's localhost via 10.0.2.2; a LAN IP may not be routable from it.
const isAndroidEmulator =
  Platform.OS === 'android' &&
  /generic|emulator|sdk_gphone/i.test(
    `${Platform.constants.Fingerprint} ${Platform.constants.Model}`,
  );

type Settings = { host: string; logServer: string; backForwardGestures: boolean };

const DEFAULT_SETTINGS: Settings = {
  host: isAndroidEmulator ? '10.0.2.2' : defaultHost.host,
  logServer: '',
  backForwardGestures: false,
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    readFile(SETTINGS_PATH)
      .then(s => ({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }))
      .catch(() => DEFAULT_SETTINGS)
      .then(s => {
        setLogServer(s.logServer);
        setSettings(s);
      });
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings!, ...patch };
    setSettings(next);
    setLogServer(next.logServer);
    writeFile(SETTINGS_PATH, JSON.stringify(next)).catch(() => {});
  };

  const close = useCallback(() => setUrl(null), []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {settings &&
        (url ? (
          <WebScreen
            url={url}
            backForwardGestures={settings.backForwardGestures}
            onClose={close}
          />
        ) : (
          <Home settings={settings} update={update} open={setUrl} />
        ))}
    </SafeAreaProvider>
  );
}

function Home({
  settings,
  update,
  open,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  open: (url: string) => void;
}) {
  const insets = useSafeAreaInsets();
  // Text fields are committed on blur/submit so every keystroke doesn't hit the disk.
  const [host, setHost] = useState(settings.host);
  const [logServer, setLogServerText] = useState(settings.logServer);
  const [freeUrl, setFreeUrl] = useState('');

  const openFree = () => {
    const u = freeUrl.trim();
    if (u) open(/^[a-z]+:\/\//i.test(u) ? u : `http://${u}`);
  };

  return (
    <ScrollView
      style={styles.home}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>RouteStack Test</Text>

      <Text style={styles.label}>Host (Mac LAN IP)</Text>
      <TextInput
        style={styles.input}
        value={host}
        onChangeText={setHost}
        onEndEditing={() => update({ host: host.trim() })}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        clearButtonMode="while-editing"
        accessibilityLabel="Host"
      />

      {APPS.map(([name, port]) => {
        const appUrl = `http://${settings.host}:${port}/`;
        return (
          <Pressable
            key={name}
            style={styles.row}
            onPress={() => open(appUrl)}
            accessibilityLabel={name}
          >
            <Text style={styles.rowTitle}>{name}</Text>
            <Text style={styles.rowSub}>{appUrl}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.label}>URL</Text>
      <View style={styles.inline}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={freeUrl}
          onChangeText={setFreeUrl}
          onSubmitEditing={openFree}
          placeholder="http://192.168.0.10:3100/search"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          clearButtonMode="while-editing"
          returnKeyType="go"
          accessibilityLabel="URL"
        />
        <Pressable onPress={openFree} style={styles.go}>
          <Text style={styles.goText}>Go</Text>
        </Pressable>
      </View>

      {Platform.OS === 'ios' && (
        <View style={[styles.inline, styles.switchRow]}>
          <Text style={styles.flex}>allowsBackForwardNavigationGestures</Text>
          <Switch
            value={settings.backForwardGestures}
            onValueChange={v => update({ backForwardGestures: v })}
            accessibilityLabel="allowsBackForwardNavigationGestures"
          />
        </View>
      )}

      <Text style={styles.label}>Log server (POST, empty = off)</Text>
      <TextInput
        style={styles.input}
        value={logServer}
        onChangeText={setLogServerText}
        onEndEditing={() => update({ logServer: logServer.trim() })}
        placeholder={`http://${settings.host}:4174/`}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        clearButtonMode="while-editing"
        accessibilityLabel="Log server"
      />
      <Text style={styles.note} selectable>
        Log file: {LOG_PATH}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  home: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  h1: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  label: { marginTop: 16, marginBottom: 4, color: '#666', fontSize: 13 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#000',
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTitle: { fontSize: 17 },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  go: { paddingHorizontal: 16, paddingVertical: 8 },
  goText: { color: '#007aff', fontSize: 17 },
  switchRow: { marginTop: 20 },
  note: { marginTop: 16, fontSize: 11, color: '#888' },
});
