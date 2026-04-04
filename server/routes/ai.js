const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

async function getSettings() {
  const { data } = await supabase.from('settings').select('key, value');
  return (data || []).reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
}

// POST enhance text with Claude AI
router.post('/enhance', async (req, res) => {
  const { text, style } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'טקסט ריק' });
  }

  const settings = await getSettings();
  const apiKey = settings.claude_api_key || process.env.CLAUDE_API_KEY || '';

  if (!apiKey.trim()) {
    return res.status(400).json({
      error: 'מפתח Claude API לא הוגדר. הגדר אותו בעמוד ההגדרות.'
    });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const styleInstructions = {
      professional: 'מקצועי ועסקי, תמציתי',
      friendly: 'חברותי ואישי, עם אימוג\'י מתאימים',
      sales: 'שיווקי ומזמין, עם קריאה לפעולה',
      informative: 'אינפורמטיבי ומפורט',
    };

    const styleGuide = styleInstructions[style] || styleInstructions.friendly;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `אתה עוזר לכתיבת פוסטים לקבוצות פייסבוק בישראל.

שפר את הפוסט הבא בסגנון: ${styleGuide}.
הפוסט צריך להיות בעברית, מושך תשומת לב, ומתאים לפרסום בקבוצות פייסבוק.
החזר רק את הטקסט המשופר, ללא הסברים נוספים.

פוסט מקורי:
${text.trim()}`
      }]
    });

    res.json({ enhanced: message.content[0].text });
  } catch (error) {
    console.error('[AI] Error:', error.message);
    if (error.message.includes('API key') || error.status === 401) {
      return res.status(401).json({ error: 'מפתח API לא תקין' });
    }
    res.status(500).json({ error: 'שגיאה בחיבור ל-AI: ' + error.message });
  }
});

// GET settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();

    const key = settings.claude_api_key || '';
    const masked = key.length > 8 ? key.slice(0, 4) + '****' + key.slice(-4) : (key ? '****' : '');

    res.json({
      claude_api_key_masked: masked,
      has_api_key: key.length > 0,
      min_delay_seconds: settings.min_delay_seconds || '45',
      max_delay_seconds: settings.max_delay_seconds || '120',
      max_groups_per_day: settings.max_groups_per_day || '15',
      quiet_hours_start: settings.quiet_hours_start || '2',
      quiet_hours_end: settings.quiet_hours_end || '7',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save settings
router.post('/settings', async (req, res) => {
  try {
    const allowed = ['claude_api_key', 'min_delay_seconds', 'max_delay_seconds',
      'max_groups_per_day', 'quiet_hours_start', 'quiet_hours_end'];

    const rows = Object.entries(req.body)
      .filter(([key]) => allowed.includes(key))
      .map(([key, value]) => ({ key, value: String(value) }));

    if (rows.length === 0) return res.json({ success: true });

    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
