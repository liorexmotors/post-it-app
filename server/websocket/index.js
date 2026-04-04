const { WebSocketServer } = require('ws');

let wss = null;
let extensionSocket = null;
const pendingCallbacks = new Map();

function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WS] Chrome Extension connected');
    extensionSocket = ws;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(msg);
      } catch (e) {
        console.error('[WS] Invalid message:', e.message);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Chrome Extension disconnected');
      extensionSocket = null;
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });

    // Send ping to confirm connection
    send({ type: 'ping' });
  });

  console.log('[WS] WebSocket server ready');
  return wss;
}

function send(data) {
  if (!extensionSocket || extensionSocket.readyState !== 1) {
    return false;
  }
  extensionSocket.send(JSON.stringify(data));
  return true;
}

function handleMessage(msg) {
  const { type, requestId, data, error } = msg;

  // Handle responses to our requests
  if (requestId && pendingCallbacks.has(requestId)) {
    const { resolve, reject } = pendingCallbacks.get(requestId);
    pendingCallbacks.delete(requestId);
    if (error) {
      reject(new Error(error));
    } else {
      resolve(data);
    }
    return;
  }

  // Handle unsolicited messages
  switch (type) {
    case 'pong':
      console.log('[WS] Extension pong received');
      break;
    case 'post_result':
      handlePostResult(data);
      break;
    case 'groups_synced':
      console.log('[WS] Groups synced:', data?.count);
      break;
    default:
      console.log('[WS] Unknown message type:', type);
  }
}

function handlePostResult(data) {
  // Handled via pending callbacks
}

function sendRequest(type, data, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== 1) {
      return reject(new Error('Extension not connected'));
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    pendingCallbacks.set(requestId, { resolve, reject });

    const timeout = setTimeout(() => {
      if (pendingCallbacks.has(requestId)) {
        pendingCallbacks.delete(requestId);
        reject(new Error('Request timed out'));
      }
    }, timeoutMs);

    send({ type, requestId, data });

    // Clear timeout on resolve/reject
    const orig = pendingCallbacks.get(requestId);
    pendingCallbacks.set(requestId, {
      resolve: (v) => { clearTimeout(timeout); orig.resolve(v); },
      reject: (e) => { clearTimeout(timeout); orig.reject(e); },
    });
  });
}

function isConnected() {
  return extensionSocket !== null && extensionSocket.readyState === 1;
}

module.exports = { initWebSocket, send, sendRequest, isConnected };
