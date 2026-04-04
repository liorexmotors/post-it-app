const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'POST-IT.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    title TEXT,
    content TEXT NOT NULL,
    media_type TEXT,
    media_path TEXT,
    media_filename TEXT,
    status TEXT DEFAULT 'pending',
    scheduled_at DATETIME,
    sent_at DATETIME,
    recurring TEXT,
    recurring_days TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS fb_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fb_group_id TEXT UNIQUE,
    name TEXT NOT NULL,
    url TEXT,
    member_count TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS post_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at DATETIME,
    error_message TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (group_id) REFERENCES fb_groups(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Insert default settings if not exist
const defaultSettings = [
  ['claude_api_key', ''],
  ['min_delay_seconds', '45'],
  ['max_delay_seconds', '120'],
  ['max_groups_per_day', '15'],
  ['quiet_hours_start', '2'],
  ['quiet_hours_end', '7'],
];

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

module.exports = db;
