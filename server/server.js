import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { initDb, db } from './db.js';

// Route imports
import authRouter from './routes/auth.js';
import alumniRouter from './routes/alumni.js';
import milestonesRouter from './routes/milestones.js';
import meetingsRouter from './routes/meetings.js';
import communicationsRouter from './routes/communications.js';
import analyticsRouter from './routes/analytics.js';
import auditRouter from './routes/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development
app.use(cors({
  origin: (origin, callback) => {
    // Dynamically allow the origin of the requesting site (e.g. Cloudflare Pages or localhost)
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Session Middleware (30 minutes session expiry)
app.use(session({
  secret: 'bgs-pu-college-alumni-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // Required for cross-origin HTTPS deployments
    sameSite: 'none', // Required for cross-origin cookies between Cloudflare and Render
    maxAge: 30 * 60 * 1000 // 30 minutes in milliseconds
  }
}));

// Serve upload attachments statically (only authenticated or handled securely, served directly for simplicity)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve React production build statically (in case client is built)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Audit Logging Helper
export async function logAudit(username, role, actionType, details) {
  try {
    await db.run(
      'INSERT INTO audit_logs (username, role, action_type, details) VALUES (?, ?, ?, ?)',
      [username || 'anonymous', role || 'Guest', actionType, details]
    );
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}

// Session Timeout & Warn Check
app.get('/api/session-check', (req, res) => {
  if (req.session.user) {
    const timeRemaining = req.session.cookie.maxAge; // time remaining in ms
    res.json({
      loggedIn: true,
      user: req.session.user,
      timeRemaining: timeRemaining
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Route registration
app.use('/api/auth', authRouter);
app.use('/api/alumni', alumniRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/audit', auditRouter);

// Fallback to React index.html for SPA routing in production
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Backend is running. Frontend build not found. Run client in dev mode.');
  }
});

// Daily Backup Simulator
// Copies the SQLite database file to the backups folder with a timestamp
export function runDatabaseBackup() {
  const dbFile = path.join(__dirname, 'bgs_alumni.db');
  if (!fs.existsSync(dbFile)) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(__dirname, 'backups', `bgs_alumni_backup_${timestamp}.db`);

  fs.copyFileSync(dbFile, backupFile);
  console.log(`[Backup System] Created database backup: ${backupFile}`);

  // Maintain 30-day retention
  try {
    const files = fs.readdirSync(path.join(__dirname, 'backups'));
    const backupFiles = files
      .filter(f => f.startsWith('bgs_alumni_backup_') && f.endsWith('.db'))
      .map(f => {
        const filePath = path.join(__dirname, 'backups', f);
        return { path: filePath, time: fs.statSync(filePath).mtime.getTime() };
      });

    // Sort by oldest first
    backupFiles.sort((a, b) => a.time - b.time);

    // If more than 30 backups exist, remove the oldest ones
    if (backupFiles.length > 30) {
      const toDelete = backupFiles.slice(0, backupFiles.length - 30);
      for (const f of toDelete) {
        fs.unlinkSync(f.path);
        console.log(`[Backup System] Retained only 30 days. Deleted old backup: ${f.path}`);
      }
    }
  } catch (err) {
    console.error('Error during old backup cleanup:', err);
  }
}

// Set up daily backup (every 24 hours)
setInterval(runDatabaseBackup, 24 * 60 * 60 * 1000);

// Initialize DB and start server
initDb()
  .then(() => {
    // Run initial backup on startup to verify it works
    runDatabaseBackup();
    
    app.listen(PORT, () => {
      console.log(`[Server] BGS Alumni backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Critical Failure: Database initialization failed.', err);
    process.exit(1);
  });
