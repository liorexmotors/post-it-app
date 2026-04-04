const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { verifySession } = require('../playwright/facebook');

// GET session status
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('fb_session')
      .select('id, is_valid, last_verified, created_at')
      .eq('is_valid', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ has_session: false });
    }

    res.json({
      has_session: true,
      is_valid: data.is_valid,
      last_verified: data.last_verified,
    });
  } catch (err) {
    res.json({ has_session: false });
  }
});

// POST save & verify session
router.post('/', async (req, res) => {
  const { cookies, user_agent } = req.body;

  if (!cookies || !cookies.trim()) {
    return res.status(400).json({ error: 'Cookie JSON is required' });
  }

  const ua = user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Validate JSON
  let parsed;
  try {
    parsed = JSON.parse(cookies);
    if (!Array.isArray(parsed)) throw new Error('Must be an array');
  } catch {
    return res.status(400).json({ error: 'Invalid JSON: cookies must be a JSON array' });
  }

  try {
    const isValid = await verifySession(cookies, ua);

    // Delete old sessions
    await supabase.from('fb_session').delete().neq('id', 0);

    // Insert new session
    const { error } = await supabase.from('fb_session').insert({
      cookies,
      user_agent: ua,
      is_valid: isValid,
      last_verified: new Date().toISOString(),
    });

    if (error) throw error;

    if (!isValid) {
      return res.status(401).json({
        error: 'Session not valid - Facebook login not detected. Please make sure you are logged in to Facebook.'
      });
    }

    res.json({ success: true, message: 'Session verified and saved successfully!' });
  } catch (err) {
    if (err.message.includes('Session not valid')) {
      return res.status(401).json({ error: err.message });
    }
    console.error('[Session] Error:', err.message);
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// DELETE session
router.delete('/', async (req, res) => {
  await supabase.from('fb_session').delete().neq('id', 0);
  res.json({ success: true });
});

module.exports = router;
