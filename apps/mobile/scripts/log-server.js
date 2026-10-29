// Receives the app's POSTed log lines: node scripts/log-server.js [port] [file]
const http = require('http');
const fs = require('fs');

const port = Number(process.argv[2] ?? 4174);
const file = process.argv[3] ?? 'webview.log';
http
  .createServer((req, res) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      if (body) {
        console.log(body);
        fs.appendFileSync(file, body + '\n');
      }
      res.end();
    });
  })
  .listen(port, '0.0.0.0', () => console.log(`log server :${port} -> ${file}`));
