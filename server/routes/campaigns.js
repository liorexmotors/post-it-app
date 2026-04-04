const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// GET all campaigns with post counts
router.get('/', async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        posts(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get sent/scheduled counts for each campaign
    const result = await Promise.all(campaigns.map(async (c) => {
      const { count: sent_count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'sent');

      const { count: scheduled_count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'scheduled');

      return {
        ...c,
        post_count: c.posts[0]?.count || 0,
        sent_count: sent_count || 0,
        scheduled_count: scheduled_count || 0,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('[Campaigns] GET:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET single campaign
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'לא נמצא' });
  res.json(data);
});

// POST create campaign
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'שם קמפיין הוא שדה חובה' });
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({ name: name.trim(), description: description || null })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT update campaign
router.put('/:id', async (req, res) => {
  const { name, description } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;

  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE campaign
router.delete('/:id', async (req, res) => {
  // Unlink posts from campaign
  await supabase
    .from('posts')
    .update({ campaign_id: null })
    .eq('campaign_id', req.params.id);

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
