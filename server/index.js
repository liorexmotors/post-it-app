require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

const { startScheduler } = require('./scheduler/index');

const app = express();
const server = http.createServer(app);

// CORS — allow Netlify frontend + localhost dev
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth (no middleware on this)
app.use('/api/auth', require('./routes/auth'));

// Protect all other routes
app.use(require('./middleware/auth'));

// Routes
app.use('/api/posts', require('./routes/posts'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/session', require('./routes/session'));

// Status endpoint (no extension in cloud — always cloud mode)
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    mode: 'cloud',
    extension_connected: false,
    timestamp: new Date().toISOString(),
  });
});

// Health check for Railway
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

// Ensure Supabase Storage bucket exists
async function ensureStorageBucket() {
  try {
    const supabase = require('./db/supabase');
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets && buckets.some(b => b.name === 'media');
    if (!exists) {
      await supabase.storage.createBucket('media', { public: true });
      console.log('[Storage] Created "media" bucket');
    }
  } catch (err) {
    console.warn('[Storage] Could not verify bucket:', err.message);
  }
}

// Start everything
async function start() {
  await ensureStorageBucket();
  startScheduler();

  server.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════╗');
    console.log('║      POST-IT Cloud Server Started      ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║  API:  http://localhost:${PORT}          ║`);
    console.log('║  Mode: Cloud (Playwright + Supabase)   ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('');
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
