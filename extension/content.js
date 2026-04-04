// POST-IT Content Script
// Runs on Facebook pages, communicates with background service worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_groups') {
    const groups = scrapeGroups();
    sendResponse({ groups });
  }
  return true;
});

function scrapeGroups() {
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

    if (name && name.length > 1) {
      groups.push({ id: groupId, name, url: `https://www.facebook.com/groups/${groupId}/` });
    }
  }
  return groups;
}
