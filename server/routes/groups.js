const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET all groups
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let query = supabase.from('fb_groups').select('*').order('name', { ascending: true });
    if (active !== undefined) {
      query = query.eq('active', active === 'true' || active === '1' ? 1 : 0);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST sync groups from Facebook using Playwright
router.post('/sync', async (req, res) => {
  const { isPlaywrightBusy, syncGroups } = require('../playwright/facebook');

  if (isPlaywrightBusy()) {
    return res.status(503).json({ error: 'המערכת עסוקה. נסה שוב בעוד דקה.' });
  }

  try {
    // This runs Playwright — may take 20-40s
    const groups = await syncGroups();

    if (!groups || groups.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: 'לא נמצאו קבוצות. ודא שנכנסת לפייסבוק ושיש לך הרשאות session תקינות.'
      });
    }

    // Upsert all groups
    const rows = groups.map(g => ({
      fb_group_id: g.id,
      name: g.name,
      url: g.url,
      active: 1,
    }));

    const { error } = await supabase
      .from('fb_groups')
      .upsert(rows, { onConflict: 'fb_group_id', ignoreDuplicates: false });

    if (error) throw error;

    res.json({
      success: true,
      count: groups.length,
      message: `${groups.length} קבוצות סונכרנו בהצלחה`
    });
  } catch (err) {
    console.error('[Groups] Sync error:', err.message);
    if (err.message.includes('No valid Facebook session')) {
      return res.status(401).json({ error: 'אין סשן פייסבוק תקין. הגדר את ה-Session בדף ההגדרות.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST add group manually
router.post('/', async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'שם וURL הם שדות חובה' });

    const match = url.match(/facebook\.com\/groups\/([^/?#]+)/);
    const fb_group_id = match ? match[1] : `manual_${Date.now()}`;

    const { data, error } = await supabase
      .from('fb_groups')
      .upsert({ fb_group_id, name, url, active: 1 }, { onConflict: 'fb_group_id' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT toggle group active status
router.put('/:id/toggle', async (req, res) => {
  try {
    const { data: group } = await supabase.from('fb_groups').select('active').eq('id', req.params.id).single();
    if (!group) return res.status(404).json({ error: 'לא נמצא' });

    const { data, error } = await supabase
      .from('fb_groups')
      .update({ active: group.active ? 0 : 1 })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE group
router.delete('/:id', async (req, res) => {
  try {
    await supabase.from('post_groups').delete().eq('group_id', req.params.id);
    const { error } = await supabase.from('fb_groups').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE all groups
router.delete('/', async (req, res) => {
  try {
    const { data: groups } = await supabase.from('fb_groups').select('id');
    if (groups && groups.length > 0) {
      const ids = groups.map(g => g.id);
      await supabase.from('post_groups').delete().in('group_id', ids);
    }
    const { error } = await supabase.from('fb_groups').delete().neq('id', 0);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
