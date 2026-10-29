// Bakes the Mac's LAN IP into the bundle as the default host; the app lets you edit it later.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let host = '';
for (const iface of ['en0', 'en1']) {
  try {
    host = execSync(`ipconfig getifaddr ${iface}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {}
  if (host) break;
}
fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'defaultHost.json'),
  JSON.stringify({ host: host || 'localhost' }) + '\n',
);
console.log(`default host: ${host || 'localhost'}`);
