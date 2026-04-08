const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../db/supabase');

// Memory storage — upload to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|mov|avi|webm/i;
    if (allowed.test(file.originalname.split('.').pop())) {
      cb(null, true);
    } else {
      cb(new Error('סוג קובץ לא נתמך'));
    }
  }
});

async function uploadMedia(file) {
  const ext = file.originalname.split('.').pop().toLowerCase();
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `posts/${filename}`;

  const { error } = await supabase.storage
    .from('media')
    .upload(path, file.buffer, { contentType: file.mimetype });

  if (error) throw new Error('Media upload failed: ' + error.message);

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, filename };
}

// GET all posts with group counts
router.get('/', async (req, res) => {
  try {
    const { status, campaign_id, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('posts')
      .select(`
        *,
        campaigns(name),
        post_groups(status)
      `)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (campaign_id) query = query.eq('campaign_id', campaign_id);

    const { data, error } = await query;
    if (error) throw error;

    const posts = data.map(p => ({
      ...p,
      campaign_name: p.campaigns?.name || null,
      total_groups: p.post_groups?.length || 0,
      sent_groups: p.post_groups?.filter(pg => pg.status === 'sent').length || 0,
      failed_groups: p.post_groups?.filter(pg => pg.status === 'failed').length || 0,
    }));

    res.json(posts);
  } catch (err) {
    console.error('[Posts] GET:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET single post with groups
router.get('/stats/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [
      { count: total_posts },
      { count: sent_today },
      { count: scheduled },
      { count: total_groups },
      { count: total_sent },
    ] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('post_groups').select('*', { count: 'exact', head: true })
        .eq('status', 'sent').gte('sent_at', today + 'T00:00:00'),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
      supabase.from('fb_groups').select('*', { count: 'exact', head: true }).eq('active', 1),
      supabase.from('post_groups').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    ]);

    // Last 7 days chart data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: chartRaw } = await supabase
      .from('post_groups')
      .select('sent_at')
      .eq('status', 'sent')
      .gte('sent_at', sevenDaysAgo.toISOString());

    // Group by date
    const dateMap = {};
    for (const row of (chartRaw || [])) {
      const date = row.sent_at.slice(0, 10);
      dateMap[date] = (dateMap[date] || 0) + 1;
    }
    const chartData = Object.entries(dateMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ total_posts, sent_today, scheduled, total_groups, total_sent, chartData });
  } catch (err) {
    console.error('[Posts] Stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data: post, error } = await supabase
      .from('posts').select('*').eq('id', req.params.id).single();

    if (error || !post) return res.status(404).json({ error: 'לא נמצא' });

    const { data: groups } = await supabase
      .from('post_groups')
      .select('*, fb_groups(name, fb_group_id, url)')
      .eq('post_id', req.params.id);

    res.json({ ...post, groups: groups || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new post
router.post('/', upload.array('media', 6), async (req, res) => {
  try {
    const { title, content, campaign_id, scheduled_at, recurring, recurring_days, group_ids } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'תוכן הפוסט הוא שדה חובה' });
    }

    const parsedGroupIds = group_ids ? JSON.parse(group_ids) : [];
    if (parsedGroupIds.length === 0) {
      return res.status(400).json({ error: 'יש לבחור לפחות קבוצה אחת' });
    }

    let mediaType = null;
    let mediaPath = null;
    let mediaFilename = null;

    const files = req.files || [];
    if (files.length > 0) {
      const uploaded = await Promise.all(files.map(uploadMedia));
      const ext = uploaded[0].filename.split('.').pop().toLowerCase();
      mediaType = ['mp4', 'mov', 'avi', 'webm'].includes(ext) ? 'video' : 'image';
      // Store single URL for video, JSON array for images
      mediaPath = uploaded.length === 1 ? uploaded[0].url : JSON.stringify(uploaded.map(u => u.url));
      mediaFilename = uploaded.length === 1 ? uploaded[0].filename : JSON.stringify(uploaded.map(u => u.filename));
    }

    const status = scheduled_at ? 'scheduled' : 'pending';

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        campaign_id: campaign_id || null,
        title: title || null,
        content: content.trim(),
        media_type: mediaType,
        media_path: mediaPath,
        media_filename: mediaFilename,
        status,
        scheduled_at: scheduled_at || null,
        recurring: recurring || null,
        recurring_days: recurring_days || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert post-group relationships
    const pgRows = parsedGroupIds.map(gid => ({ post_id: post.id, group_id: parseInt(gid) }));
    const { error: pgError } = await supabase.from('post_groups').insert(pgRows);
    if (pgError) throw pgError;

    res.status(201).json(post);
  } catch (err) {
    console.error('[Posts] POST:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT update post
router.put('/:id', async (req, res) => {
  try {
    const { title, content, scheduled_at, recurring, recurring_days, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content) updates.content = content;
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at || null;
    if (recurring !== undefined) updates.recurring = recurring || null;
    if (recurring_days !== undefined) updates.recurring_days = recurring_days || null;
    if (status) updates.status = status;

    const { data, error } = await supabase
      .from('posts').update(updates).eq('id', req.params.id).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE post
router.delete('/:id', async (req, res) => {
  try {
    const { data: post } = await supabase.from('posts').select('*').eq('id', req.params.id).single();
    if (!post) return res.status(404).json({ error: 'לא נמצא' });

    // Delete media from storage if exists
    if (post.media_filename) {
      await supabase.storage.from('media').remove([`posts/${post.media_filename}`]);
    }

    await supabase.from('post_groups').delete().eq('post_id', req.params.id);
    const { error } = await supabase.from('posts').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST send post now (manual trigger — runs Playwright in background)
router.post('/:id/send-now', async (req, res) => {
  try {
    const { data: post } = await supabase.from('posts').select('*').eq('id', req.params.id).single();
    if (!post) return res.status(404).json({ error: 'לא נמצא' });

    const { data: pendingGroups } = await supabase
      .from('post_groups')
      .select('*, fb_groups(fb_group_id, name, url)')
      .eq('post_id', req.params.id)
      .eq('status', 'pending');

    if (!pendingGroups || pendingGroups.length === 0) {
      return res.status(400).json({ error: 'כל הקבוצות כבר קיבלו את הפוסט הזה' });
    }

    const { isPlaywrightBusy } = require('../playwright/facebook');
    if (isPlaywrightBusy()) {
      return res.status(503).json({ error: 'המערכת עסוקה כרגע בשליחה אחרת. נסה שוב בעוד דקה.' });
    }

    // Mark as sending
    await supabase.from('posts').update({ status: 'sending' }).eq('id', req.params.id);

    // Dispatch in background
    const { dispatchPost } = require('../scheduler/index');
    dispatchPost(post, pendingGroups).catch(err => {
      console.error('[Posts] Manual dispatch error:', err.message);
    });

    res.json({ success: true, message: `שולח לפייסבוק... (${pendingGroups.length} קבוצות)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
