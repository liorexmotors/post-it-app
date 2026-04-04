const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const supabase = require('../db/supabase');

let isBusy = false;

async function getSession() {
  const { data, error } = await supabase
    .from('fb_session')
    .select('*')
    .eq('is_valid', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

async function launchBrowser(session) {
  let cookies = [];
  try {
    cookies = JSON.parse(session.cookies);
  } catch {
    throw new Error('Invalid session cookies format');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: session.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'he-IL',
  });

  await context.addCookies(cookies);
  return { browser, context };
}

async function postToGroup({ groupUrl, content, mediaType, mediaPath }) {
  if (isBusy) throw new Error('Playwright is busy, try again later');
  isBusy = true;

  const session = await getSession();
  if (!session) {
    isBusy = false;
    throw new Error('No valid Facebook session. Please set up session in Settings.');
  }

  const { browser, context } = await launchBrowser(session);
  const page = await context.newPage();

  try {
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 3500);

    // Find the "Write something" compose box
    const composeSelectors = [
      '[data-testid="status-attachment-mentions-input"]',
      '[aria-label="Write something..."]',
      '[aria-label="כתוב משהו..."]',
      'div[role="button"][tabindex="0"]',
    ];

    let clicked = false;
    for (const sel of composeSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          clicked = true;
          break;
        }
      } catch { /* try next */ }
    }

    if (!clicked) {
      // Last resort: try to find any clickable area that opens composer
      await page.click('div[role="button"]:first-child', { timeout: 5000 }).catch(() => {});
    }

    await randomDelay(1500, 2500);

    // Type content with human-like speed
    await humanType(page, content);

    // Attach media if provided
    if (mediaType && mediaPath) {
      const tempFile = await prepareMediaFile(mediaPath);
      if (tempFile) {
        try {
          // Click the photo/video button
          const mediaButtons = [
            '[aria-label*="Photo"]',
            '[aria-label*="photo"]',
            '[aria-label*="Video"]',
            'input[type="file"]',
          ];

          let fileInput = await page.$('input[type="file"]');
          if (!fileInput) {
            for (const sel of mediaButtons.slice(0, -1)) {
              const btn = await page.$(sel);
              if (btn) {
                await btn.click();
                await randomDelay(800, 1200);
                fileInput = await page.$('input[type="file"]');
                break;
              }
            }
          }

          if (fileInput) {
            await fileInput.setInputFiles(tempFile);
            await randomDelay(2000, 4000); // Wait for upload
          }
        } finally {
          try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
        }
      }
    }

    await randomDelay(800, 1200);

    // Click Post button
    const postSelectors = [
      '[aria-label="Post"]',
      '[data-testid="react-composer-post-button"]',
      'button:has-text("Post")',
      'button:has-text("פרסם")',
    ];

    let posted = false;
    for (const sel of postSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn && await btn.isEnabled()) {
          await btn.click();
          posted = true;
          await randomDelay(2000, 3000);
          break;
        }
      } catch { /* try next */ }
    }

    if (!posted) {
      throw new Error('Could not find Post button');
    }

    return { success: true };
  } finally {
    await browser.close();
    isBusy = false;
  }
}

async function syncGroups() {
  if (isBusy) throw new Error('Playwright is busy, try again later');
  isBusy = true;

  const session = await getSession();
  if (!session) {
    isBusy = false;
    throw new Error('No valid Facebook session');
  }

  const { browser, context } = await launchBrowser(session);
  const page = await context.newPage();

  const groups = [];

  try {
    await page.goto('https://www.facebook.com/groups/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await randomDelay(2000, 3000);

    // Scroll to load more groups
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await randomDelay(800, 1200);
    }

    // Scrape group links and names
    const scraped = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Find group links
      const links = document.querySelectorAll('a[href*="/groups/"]');
      for (const link of links) {
        const href = link.href;
        const match = href.match(/facebook\.com\/groups\/([^/?#]+)/);
        if (!match) continue;

        const groupId = match[1];
        if (seen.has(groupId) || /^(feed|discover|create|join|search)$/i.test(groupId)) continue;
        seen.add(groupId);

        // Get name from link text or aria-label
        const name = link.textContent?.trim() ||
                     link.getAttribute('aria-label')?.trim() ||
                     groupId;

        if (name && name.length > 1) {
          results.push({
            id: groupId,
            name,
            url: `https://www.facebook.com/groups/${groupId}/`,
          });
        }
      }

      return results;
    });

    groups.push(...scraped);

    // Also try the groups list page
    await page.goto('https://www.facebook.com/groups/?category=joined', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    }).catch(() => {});
    await randomDelay(2000, 3000);

    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await randomDelay(600, 1000);
    }

    const scraped2 = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const links = document.querySelectorAll('a[href*="/groups/"]');

      for (const link of links) {
        const href = link.href;
        const match = href.match(/facebook\.com\/groups\/([^/?#]+)/);
        if (!match) continue;

        const groupId = match[1];
        if (seen.has(groupId) || /^(feed|discover|create|join|search)$/i.test(groupId)) continue;
        seen.add(groupId);

        const name = link.textContent?.trim() ||
                     link.getAttribute('aria-label')?.trim() ||
                     groupId;

        if (name && name.length > 1) {
          results.push({
            id: groupId,
            name,
            url: `https://www.facebook.com/groups/${groupId}/`,
          });
        }
      }
      return results;
    });

    // Merge, dedup
    const allIds = new Set(groups.map(g => g.id));
    for (const g of scraped2) {
      if (!allIds.has(g.id)) {
        groups.push(g);
        allIds.add(g.id);
      }
    }

    return groups;
  } finally {
    await browser.close();
    isBusy = false;
  }
}

async function verifySession(cookiesJson, userAgent) {
  let cookies;
  try {
    cookies = JSON.parse(cookiesJson);
  } catch {
    throw new Error('Invalid JSON format for cookies');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ userAgent });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });
    const url = page.url();
    const isLoggedIn = !url.includes('/login') && !url.includes('/checkpoint');
    return isLoggedIn;
  } finally {
    await browser.close();
  }
}

async function humanType(page, text) {
  // Click on the active element and type
  await page.keyboard.type(text.slice(0, 1));
  for (const char of text.slice(1)) {
    await page.waitForTimeout(Math.floor(Math.random() * 80) + 25);
    await page.keyboard.type(char);
  }
}

async function prepareMediaFile(mediaPath) {
  // mediaPath is a Supabase Storage URL
  if (mediaPath && mediaPath.startsWith('http')) {
    try {
      const https = require('https');
      const http = require('http');
      const url = new URL(mediaPath);
      const ext = path.extname(url.pathname) || '.jpg';
      const tempPath = path.join(os.tmpdir(), `postit_${Date.now()}${ext}`);

      await new Promise((resolve, reject) => {
        const client = url.protocol === 'https:' ? https : http;
        const file = fs.createWriteStream(tempPath);
        client.get(mediaPath, (response) => {
          response.pipe(file);
          file.on('finish', () => file.close(resolve));
        }).on('error', reject);
      });

      return tempPath;
    } catch (err) {
      console.error('[Playwright] Failed to download media:', err.message);
      return null;
    }
  }
  return null;
}

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPlaywrightBusy() {
  return isBusy;
}

module.exports = { postToGroup, syncGroups, verifySession, isPlaywrightBusy };
