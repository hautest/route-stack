import { appendFile, DocumentDirectoryPath } from '@dr.pogodin/react-native-fs';

export const LOG_PATH = `${DocumentDirectoryPath}/webview.log`;

let logServer = '';
export function setLogServer(url: string) {
  logServer = url.trim();
}

// appendFile calls are independent native calls; chaining keeps lines in order.
let chain = Promise.resolve();

export function log(entry: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), ...entry });
  if (__DEV__) console.log(line);
  chain = chain.then(() => appendFile(LOG_PATH, line + '\n')).catch(() => {});
  if (logServer) {
    fetch(logServer, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: line,
    }).catch(() => {});
  }
}
