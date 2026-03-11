const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { DB_FILE } = require('./constants');

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating settings table:', err.message);
      } else {
        // 插入默认标题
        db.get("SELECT value FROM settings WHERE key = 'title'", (err, row) => {
          if (!row) {
            db.run("INSERT INTO settings (key, value) VALUES ('title', 'CloudGallery')");
          }
        });
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS user_mounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mountPoint TEXT NOT NULL,
      localPath TEXT NOT NULL,
      type TEXT DEFAULT 'local',
      config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, mountPoint)
    )`, (err) => {
      if (err) {
        console.error('Error creating user_mounts table:', err.message);
      } else {
        db.run('CREATE INDEX IF NOT EXISTS idx_user_mounts_user ON user_mounts(user_id)', () => void 0);
      }
    });

    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      wallpaper TEXT DEFAULT NULL,
      fullscreen_cover_dock INTEGER DEFAULT 0,
      dock_position TEXT DEFAULT 'bottom',
      dock_mode TEXT DEFAULT 'floating',
      window_style TEXT DEFAULT 'mac',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
      } else {
        // Add wallpaper column if not exists (for existing databases)
        db.run("ALTER TABLE users ADD COLUMN wallpaper TEXT DEFAULT NULL", (_err) => { void _err; });
        
        // Add current_token column for SSO (single sign-on)
        db.run("ALTER TABLE users ADD COLUMN current_token TEXT DEFAULT NULL", (_err) => { void _err; });

        db.run("ALTER TABLE users ADD COLUMN fullscreen_cover_dock INTEGER DEFAULT 0", (_err) => { void _err; });

        db.run("ALTER TABLE users ADD COLUMN dock_position TEXT DEFAULT 'bottom'", (_err) => { void _err; });

        db.run("ALTER TABLE users ADD COLUMN dock_mode TEXT DEFAULT 'floating'", (_err) => { void _err; });

        db.run("ALTER TABLE users ADD COLUMN window_style TEXT DEFAULT 'mac'", (_err) => { void _err; });
        
        // Create default admin if not exists
        db.get("SELECT id FROM users WHERE username = 'admin'", async (err, row) => {
          if (!row) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashedPassword, 'admin']);
            console.log('Default admin user created (admin/admin)');
          }
        });
      }
    });

    // Create favorites table
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, path)
    )`, (err) => {
      if (err) console.error('Error creating favorites table:', err.message);
    });

    // Create app_data table
    db.run(`CREATE TABLE IF NOT EXISTS app_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      user_id INTEGER,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(app_id, user_id, key)
    )`, (err) => {
      if (err) console.error('Error creating app_data table:', err.message);
    });

    // Create share_links table
    db.run(`CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      downloads INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating share_links table:', err.message);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS trash_items (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      trash_path TEXT NOT NULL,
      deleted_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, trash_path)
    )`, (err) => {
      if (err) {
        console.error('Error creating trash_items table:', err.message);
      } else {
        db.run('CREATE INDEX IF NOT EXISTS idx_trash_items_user ON trash_items(user_id)', () => void 0);
        db.run('CREATE INDEX IF NOT EXISTS idx_trash_items_original ON trash_items(user_id, original_path)', () => void 0);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      query TEXT,
      status INTEGER,
      duration_ms INTEGER,
      ip TEXT,
      user_agent TEXT,
      user_id INTEGER,
      user_role TEXT,
      action TEXT,
      req_body TEXT,
      res_size INTEGER,
      error TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating request_logs table:', err.message);
      }
    });

    db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_ts ON request_logs(ts)', () => void 0);
    db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status)', () => void 0);
    db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path)', () => void 0);

    db.run(`CREATE TABLE IF NOT EXISTS downloader_tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'http',
      url TEXT NOT NULL,
      dir_path TEXT NOT NULL,
      filename TEXT,
      target_path TEXT,
      status TEXT NOT NULL,
      total_bytes INTEGER DEFAULT 0,
      downloaded_bytes INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      updated_at INTEGER NOT NULL,
      error TEXT,
      headers TEXT,
      overwrite INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      etag TEXT,
      last_modified TEXT,
      meta TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating downloader_tasks table:', err.message);
      } else {
        db.run('CREATE INDEX IF NOT EXISTS idx_downloader_tasks_user ON downloader_tasks(user_id, created_at)', () => void 0);
        db.run('CREATE INDEX IF NOT EXISTS idx_downloader_tasks_status ON downloader_tasks(status, updated_at)', () => void 0);
        db.run("ALTER TABLE downloader_tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'http'", (_err) => { void _err; });
        db.run("ALTER TABLE downloader_tasks ADD COLUMN url TEXT NOT NULL DEFAULT ''", (_err) => { void _err; });
        db.run("ALTER TABLE downloader_tasks ADD COLUMN dir_path TEXT NOT NULL DEFAULT '/'", (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN filename TEXT', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN target_path TEXT', (_err) => { void _err; });
        db.run("ALTER TABLE downloader_tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'queued'", (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN total_bytes INTEGER DEFAULT 0', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN downloaded_bytes INTEGER DEFAULT 0', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN started_at INTEGER', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN finished_at INTEGER', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN error TEXT', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN headers TEXT', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN overwrite INTEGER DEFAULT 0', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN retry_count INTEGER DEFAULT 0', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN etag TEXT', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN last_modified TEXT', (_err) => { void _err; });
        db.run('ALTER TABLE downloader_tasks ADD COLUMN meta TEXT', (_err) => { void _err; });
      }
    });
  }
});

module.exports = db;
