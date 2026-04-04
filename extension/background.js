// POST-IT Background Service Worker
// Manages WebSocket connection to local server and dispatches post tasks

const SERVER_URL = 'ws://localhost:3001';
const API_URL = 'http://localhost:3001';

let ws = null;
let reconnectTimer = null;
let isConnected = false;
let postQueue = [];
let activeJob = null;

// ── WebSocket Connection ──────────────────────────────────────────────────────

function connect() {
  if (ws && ws.readyState <= 1) return;

  ws = new WebSocket(SERVER_URL);

  ws.onopen = () => {
    isConnected = true;
    console.log('[POST-IT] Connected to server');
    clearTimeout(reconnectTimer);
    updateBadge('on');
    ws.send(JSON.stringify({ type: 'pong' }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (e) {
      console.error('[POST-IT] Invalid message:', e);
    }
  };

  ws.onerror = () => {
    updateBadge('off');
  };

  ws.onclose = () => {
    isConnected = false;
    updateBadge('off');
    console.log('[POST-IT] Disconnected, reconnecting in 5s...');
    reconnectTimer = setTimeout(connect, 5000);
  };
}

function send(data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function updateBadge(state) {
  if (state === 'on') {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// ── Message Handler ───────────────────────────────────────────────────────────

function handleMessage(msg) {
  const { type, data } = msg;

  switch (type) {
    case 'ping':
      send({ type: 'pong' });
      break;
    case 'sync_groups':
      syncFacebookGroups();
      break;
    case 'dispatch_post':
      if (activeJob) {
        postQueue.push(data);
        console.log('[POST-IT] Post queued');
      } else {
        startPostJob(data);
      }
      break;
    default:
      console.log('[POST-IT] Unknown message:', type);
  }
}

// ── Group Sync ────────────────────────────────────────────────────────────────

async function syncFacebookGroups() {
  console.log('[POST-IT] Syncing Facebook groups...');
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.facebook.com/*' });
    let fbTab = tabs[0];

    if (!fbTab) {
      fbTab = await chrome.tabs.create({ url: 'https://www.facebook.com/groups/', active: true });
      await new Promise(r => setTimeout(r, 4000));
    } else {
      await chrome.tabs.update(fbTab.id, { url: 'https://www.facebook.com/groups/', active: true });
      await new Promise(r => setTimeout(r, 3000));
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: fbTab.id },
      func: scrapeGroupsFromPage,
    });

    const groups = results[0]?.result || [];
    console.log('[POST-IT] Found groups:', groups.length);

    await fetch(`${API_URL}/api/groups/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups })
    });

    send({ type: 'groups_synced', data: { count: groups.length } });
  } catch (err) {
    console.error('[POST-IT] Sync error:', err);
    send({ type: 'groups_synced', data: { count: 0, error: err.message } });
  }
}

function scrapeGroupsFromPage() {
  const groups = [];
  const seen = new Set();
  const links = document.querySelectorAll('a[href*="/groups/"]');

  for (const link of links) {
    const href = link.href || '';
    const match = href.match(/facebook\.com\/groups\/([^/?#]+)/);
    if (!match) continue;

    const groupId = match[1];
    if (seen.has(groupId) || ['feed', 'discover', 'create', 'joins'].includes(groupId)) continue;
    seen.add(groupId);

    const nameEl = link.querySelector('[dir="auto"]') || link.querySelector('span') || link;
    const name = nameEl.textContent?.trim() || groupId;

    if (name && name.length > 1 && name !== groupId) {
      groups.push({
        id: groupId,
        name: name,
        url: `https://www.facebook.com/groups/${groupId}/`,
        memberCount: null
      });
    }
  }
  return groups;
}

// ── Post Dispatcher ───────────────────────────────────────────────────────────

async function startPostJob(jobData) {
  activeJob = jobData;
  const { postId, content, mediaType, mediaUrl, groups, minDelay, maxDelay } = jobData;

  console.log(`[POST-IT] Starting post #${postId} to ${groups.length} groups`);

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    console.log(`[POST-IT] (${i + 1}/${groups.length}) Posting to "${group.name}"`);

    try {
      await postToGroup(group, content, mediaType, mediaUrl);
      await reportResult(postId, group.group_id, 'sent', null);
      console.log(`[POST-IT] OK: "${group.name}"`);
    } catch (err) {
      console.error(`[POST-IT] FAIL: "${group.name}" -`, err.message);
      await reportResult(postId, group.group_id, 'failed', err.message);
    }

    if (i < groups.length - 1) {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  activeJob = null;
  if (postQueue.length > 0) {
    startPostJob(postQueue.shift());
  }
}

async function reportResult(postId, groupId, status, error) {
  try {
    await fetch(`${API_URL}/api/extension/post-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, groupId, status, error })
    });
  } catch (e) {
    console.error('[POST-IT] Failed to report result:', e);
  }
}

async function postToGroup(group, content, mediaType, mediaUrl) {
  const url = group.url || `https://www.facebook.com/groups/${group.fb_group_id}/`;

  const tabs = await chrome.tabs.query({ url: 'https://www.facebook.com/*' });
  let tab;

  if (tabs.length > 0) {
    tab = await chrome.tabs.update(tabs[0].id, { url, active: true });
  } else {
    tab = await chrome.tabs.create({ url, active: true });
  }

  await waitForTabLoad(tab.id, 10000);
  await new Promise(r => setTimeout(r, 2500));

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: doPostOnPage,
    args: [content, mediaType, mediaUrl]
  });

  const result = results[0]?.result;
  if (!result || result.error) {
    throw new Error(result?.error || 'פרסום נכשל');
  }
  return result;
}

function waitForTabLoad(tabId, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// This function is injected into the Facebook page
async function doPostOnPage(content, mediaType, mediaUrl) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function humanType(el, text) {
    el.focus();
    for (const ch of text) {
      document.execCommand('insertText', false, ch);
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 25 + Math.random() * 75));
    }
  }

  try {
    // 1. Open compose box
    const composeSelectors = [
      'div[aria-label*="Write something"]',
      'div[aria-label*="כתוב משהו"]',
      'div[aria-label*="מה בראשך"]',
      'div[role="button"][tabindex="0"]',
    ];

    let clicked = false;
    for (const sel of composeSelectors) {
      const el = document.querySelector(sel);
      if (el) { el.click(); clicked = true; break; }
    }

    if (!clicked) {
      // Try clicking the first interactive area
      const box = document.querySelector('div[contenteditable="true"]');
      if (box) { box.click(); }
    }

    await sleep(1500);

    // 2. Find text input
    let textBox = document.querySelector('div[contenteditable="true"][role="textbox"]')
      || document.querySelector('div[contenteditable="true"]');

    if (!textBox) return { error: 'לא נמצאה תיבת טקסט' };

    textBox.click();
    await sleep(300);
    await humanType(textBox, content);
    await sleep(800);

    // 3. Upload media if needed
    if (mediaType && mediaUrl) {
      try {
        const photoBtn = document.querySelector('[aria-label*="Photo"]')
          || document.querySelector('[aria-label*="תמונה"]')
          || document.querySelector('[aria-label*="Video"]');

        if (photoBtn) {
          photoBtn.click();
          await sleep(1200);

          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput) {
            const resp = await fetch(mediaUrl);
            const blob = await resp.blob();
            const fname = mediaUrl.split('/').pop();
            const file = new File([blob], fname, { type: blob.type });
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(4000);
          }
        }
      } catch (e) {
        console.warn('[POST-IT] Media upload failed:', e.message);
      }
    }

    await sleep(800);

    // 4. Click Post/Publish button
    let postBtn = null;
    const allBtns = document.querySelectorAll('[role="button"]');
    for (const btn of allBtns) {
      const txt = btn.textContent?.trim();
      if (txt === 'Post' || txt === 'פרסם' || txt === 'Share' || txt === 'שתף') {
        postBtn = btn;
        break;
      }
    }

    if (!postBtn) {
      postBtn = document.querySelector('[aria-label="Post"]')
        || document.querySelector('[aria-label="פרסם"]');
    }

    if (!postBtn) return { error: 'לא נמצא כפתור פרסום' };

    postBtn.click();
    await sleep(3000);

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  connect();
});

chrome.runtime.onStartup.addListener(() => {
  connect();
});

chrome.alarms.create('keepalive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive' && !isConnected) {
    connect();
  }
});

connect();
