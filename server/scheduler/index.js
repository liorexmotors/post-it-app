const cron = require('node-cron');
const supabase = require('../db/supabase');

let schedulerRunning = false;
let isDispatching = false;

function startScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  cron.schedule('* * * * *', () => {
    checkAndDispatchPosts().catch(err =>
      console.error('[Scheduler] Error:', err.message)
    );
  });

  console.log('[Scheduler] Started — checking every minute');
}

async function getSettings() {
  const { data } = await supabase.from('settings').select('key, value');
  return (data || []).reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
}

async function checkAndDispatchPosts() {
  if (isDispatching) return; // Prevent overlap

  const settings = await getSettings();
  const now = new Date();
  const hour = now.getHours();

  // Quiet hours check
  const quietStart = parseInt(settings.quiet_hours_start || '2');
  const quietEnd = parseInt(settings.quiet_hours_end || '7');
  if (hour >= quietStart && hour < quietEnd) return;

  // Find scheduled posts that are due
  const nowISO = now.toISOString();

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowISO);

  if (!posts || posts.length === 0) return;

  for (const post of posts) {
    // Get pending groups for this post
    const { data: pendingGroups } = await supabase
      .from('post_groups')
      .select('*, fb_groups(fb_group_id, name, url)')
      .eq('post_id', post.id)
      .eq('status', 'pending')
      .limit(parseInt(settings.max_groups_per_day || '15'));

    if (!pendingGroups || pendingGroups.length === 0) {
      // All groups done — mark complete
      await supabase.from('posts').update({ status: 'sent', sent_at: nowISO }).eq('id', post.id);
      continue;
    }

    // Mark as sending to prevent double-dispatch
    await supabase.from('posts').update({ status: 'sending' }).eq('id', post.id);
    console.log(`[Scheduler] Dispatching post #${post.id} to ${pendingGroups.length} groups`);

    // Run in background — don't await
    dispatchPost(post, pendingGroups, settings).catch(err => {
      console.error(`[Scheduler] Post #${post.id} dispatch failed:`, err.message);
      supabase.from('posts').update({ status: 'scheduled' }).eq('id', post.id);
    });
  }
}

async function dispatchPost(post, pendingGroups, settings) {
  if (!settings) settings = await getSettings();
  isDispatching = true;

  const { postToGroup } = require('../playwright/facebook');

  const minDelay = parseInt(settings.min_delay_seconds || '45') * 1000;
  const maxDelay = parseInt(settings.max_delay_seconds || '120') * 1000;

  let sentCount = 0;
  let failedCount = 0;

  for (const pg of pendingGroups) {
    const group = pg.fb_groups;
    if (!group || !group.url) {
      await supabase.from('post_groups')
        .update({ status: 'failed', error_message: 'No group URL' })
        .eq('id', pg.id);
      failedCount++;
      continue;
    }

    try {
      await postToGroup({
        groupUrl: group.url,
        content: post.content,
        mediaType: post.media_type,
        mediaPath: post.media_path,
      });

      await supabase.from('post_groups').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).eq('id', pg.id);

      sentCount++;
      console.log(`[Scheduler] Posted to "${group.name}" ✓`);
    } catch (err) {
      await supabase.from('post_groups').update({
        status: 'failed',
        error_message: err.message,
      }).eq('id', pg.id);

      failedCount++;
      console.error(`[Scheduler] Failed "${group.name}":`, err.message);
    }

    // Human-like random delay between posts
    if (pg !== pendingGroups[pendingGroups.length - 1]) {
      const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
      console.log(`[Scheduler] Waiting ${Math.round(delay / 1000)}s before next group...`);
      await sleep(delay);
    }
  }

  // Final status update
  const newStatus = sentCount > 0 ? 'sent' : 'failed';
  await supabase.from('posts').update({
    status: newStatus,
    sent_at: new Date().toISOString(),
  }).eq('id', post.id);

  console.log(`[Scheduler] Post #${post.id} done: ${sentCount} sent, ${failedCount} failed`);

  // Handle recurring
  if (newStatus === 'sent' && post.recurring && post.recurring !== 'none') {
    await scheduleNextRecurring(post);
  }

  isDispatching = false;
}

async function scheduleNextRecurring(post) {
  const now = new Date();
  let nextDate = null;

  if (post.recurring === 'daily') {
    nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (post.recurring === 'weekly') {
    nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (post.recurring === 'custom' && post.recurring_days) {
    let days;
    try { days = JSON.parse(post.recurring_days); } catch { return; }
    const todayDay = now.getDay();

    for (let i = 1; i <= 7; i++) {
      if (days.includes((todayDay + i) % 7)) {
        nextDate = new Date(now);
        nextDate.setDate(nextDate.getDate() + i);
        break;
      }
    }
  }

  if (!nextDate) return;

  // Keep same time as original
  const orig = new Date(post.scheduled_at);
  nextDate.setHours(orig.getHours(), orig.getMinutes(), 0, 0);

  // Create next post
  const { data: newPost, error } = await supabase
    .from('posts')
    .insert({
      campaign_id: post.campaign_id,
      title: post.title,
      content: post.content,
      media_type: post.media_type,
      media_path: post.media_path,
      media_filename: post.media_filename,
      status: 'scheduled',
      scheduled_at: nextDate.toISOString(),
      recurring: post.recurring,
      recurring_days: post.recurring_days,
    })
    .select()
    .single();

  if (error || !newPost) return;

  // Copy group assignments
  const { data: groups } = await supabase
    .from('post_groups')
    .select('group_id')
    .eq('post_id', post.id);

  if (groups && groups.length > 0) {
    await supabase.from('post_groups').insert(
      groups.map(g => ({ post_id: newPost.id, group_id: g.group_id }))
    );
  }

  console.log(`[Scheduler] Recurring post created for ${nextDate.toISOString()}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { startScheduler, dispatchPost };
