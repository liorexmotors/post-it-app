const API_URL = 'http://localhost:3001';

async function checkStatus() {
  const statusEl = document.getElementById('status');
  const dotEl = document.getElementById('statusDot');
  const textEl = document.getElementById('statusText');
  const syncBtn = document.getElementById('syncGroups');
  const infoEl = document.getElementById('infoText');

  try {
    const res = await fetch(`${API_URL}/api/status`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();

    if (data.extension_connected) {
      statusEl.className = 'status-badge connected';
      dotEl.className = 'dot green';
      textEl.textContent = 'מחובר ופעיל ✓';
      syncBtn.disabled = false;
      infoEl.textContent = 'המערכת פעילה ומוכנה לפרסום';
    } else {
      statusEl.className = 'status-badge disconnected';
      dotEl.className = 'dot red';
      textEl.textContent = 'שרת פעיל - ממתין לחיבור';
      syncBtn.disabled = false;
      infoEl.textContent = 'השרת פועל. רענן את הדף אם התוסף לא מתחבר.';
    }
  } catch {
    statusEl.className = 'status-badge disconnected';
    dotEl.className = 'dot red';
    textEl.textContent = 'שרת לא פעיל';
    syncBtn.disabled = true;
    infoEl.textContent = 'הפעל את start.bat ואז רענן';
  }
}

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000' });
});

document.getElementById('syncGroups').addEventListener('click', async () => {
  const btn = document.getElementById('syncGroups');
  const infoEl = document.getElementById('infoText');
  btn.disabled = true;
  btn.textContent = 'מסנכרן...';

  try {
    const res = await fetch(`${API_URL}/api/groups/sync`, { method: 'POST' });
    const data = await res.json();
    infoEl.textContent = data.message || 'הסנכרון החל - בדוק את הדשבורד';
  } catch {
    infoEl.textContent = 'שגיאה בסנכרון';
  }

  btn.textContent = 'סנכרן קבוצות פייסבוק';
  setTimeout(() => { btn.disabled = false; }, 3000);
});

checkStatus();
setInterval(checkStatus, 5000);
