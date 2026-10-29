// Runs at document start in every page load. Host-side only: the web apps contain no logging code.
// Messages sent before ReactNativeWebView exists are queued and flushed on the next send / load.
export const INJECTED_BEFORE_CONTENT = `(function () {
  if (window.__rsHostLog) return;
  window.__rsHostLog = true;
  var queue = [];
  function send(msg) {
    msg.href = location.href;
    queue.push(JSON.stringify(msg));
    var bridge = window.ReactNativeWebView;
    if (!bridge) return;
    while (queue.length) bridge.postMessage(queue.shift());
  }
  function str(a) {
    try {
      // WebKit's stack omits the message, V8's starts with it.
      if (a instanceof Error) return a.stack && a.stack.indexOf(a.message) >= 0 ? a.stack : String(a) + '\\n' + (a.stack || '');
      if (typeof a === 'string') return a;
      return JSON.stringify(a);
    } catch (e) {
      return String(a);
    }
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      try { send({ type: 'console', level: level, args: args.map(str) }); } catch (e) {}
      return orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    send({ type: 'error', message: e.message, source: e.filename + ':' + e.lineno + ':' + e.colno, stack: e.error && e.error.stack });
  });
  window.addEventListener('unhandledrejection', function (e) {
    send({ type: 'unhandledrejection', reason: str(e.reason) });
  });
  send({ type: 'env', ua: navigator.userAgent, navigationApi: 'navigation' in window });
  window.addEventListener('load', function () { send({ type: 'load' }); });
})();
true;`;
