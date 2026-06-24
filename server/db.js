import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'bgs_alumni.db');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure backups folder exists
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const sqlite = sqlite3.verbose();
const rawDb = new sqlite.Database(DB_PATH);

// Wrap sqlite3 in Promises
export const db = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      rawDb.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export async function initDb() {
  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Admin', 'Viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alumni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dob TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      batch_year INTEGER NOT NULL,
      stream TEXT DEFAULT '' CHECK(stream IN ('PCMB', 'PCMCs', 'Commerce', '')),
      roll_number TEXT UNIQUE,
      current_institution_employer TEXT DEFAULT '',
      degree_pursued TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      country TEXT DEFAULT 'India',
      mobile TEXT DEFAULT '',
      email TEXT DEFAULT '',
      secondary_contact TEXT DEFAULT '',
      linkedin_url TEXT DEFAULT '',
      photo_path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alumnus_id INTEGER REFERENCES alumni(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('Education', 'Professional', 'Competitive Exam', 'Achievement')),
      field1 TEXT NOT NULL, -- degree name, company name, exam name, award name
      field2 TEXT,          -- institution, designation, score/rank, description
      field3 TEXT,          -- year of completion, joining year, exam year, award date
      field4 TEXT,          -- grade/percentage, status (current/former), exam outcome, notes
      attachment_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      datetime TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('in-person', 'phone call', 'video call')),
      staff_responsible TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL CHECK(status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
      outcome TEXT,
      recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none', 'weekly', 'monthly', 'annual')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meeting_alumni (
      meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
      alumnus_id INTEGER REFERENCES alumni(id) ON DELETE CASCADE,
      PRIMARY KEY(meeting_id, alumnus_id)
    );

    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('email', 'SMS', 'WhatsApp', 'phone call', 'in-person')),
      datetime TEXT DEFAULT CURRENT_TIMESTAMP,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      staff_initiator TEXT NOT NULL,
      response_received TEXT NOT NULL CHECK(response_received IN ('yes', 'no', 'pending')),
      response_summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS communication_alumni (
      communication_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
      alumnus_id INTEGER REFERENCES alumni(id) ON DELETE CASCADE,
      PRIMARY KEY(communication_id, alumnus_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      filters TEXT NOT NULL, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      action_type TEXT NOT NULL,
      details TEXT NOT NULL
    );
  `);

  // Seed Users
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const salt = await bcrypt.genSalt(10);
    const superadminHash = await bcrypt.hash('Admin@1234', salt);
    const adminHash = await bcrypt.hash('Admin@1234', salt);
    const viewerHash = await bcrypt.hash('Viewer@1234', salt);

    await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['superadmin', superadminHash, 'Super Admin']);
    await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', adminHash, 'Admin']);
    await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['viewer', viewerHash, 'Viewer']);
    console.log('Seeded users successfully.');
  }

  // Seed Templates
  const templateCount = await db.get('SELECT COUNT(*) as count FROM templates');
  if (templateCount.count === 0) {
    await db.run(`
      INSERT INTO templates (name, subject, body) VALUES 
      ('Welcome Message', 'Welcome to BGS PU College Alumni Network', 'Dear {{name}},\n\nWelcome to the official alumni association of BGS PU College! We are excited to keep in touch with you. Please take a moment to update your current contact details and profile details.\n\nBest regards,\nBGS PU College Admin'),
      ('Annual Alumni Meet Invite', 'Invitation: BGS PU College Annual Alumni Meet', 'Dear {{name}},\n\nWe cordially invite you to the BGS PU College Annual Alumni Meet on December 25th at our college campus. We look forward to celebrating your success and reconnecting.\n\nBest regards,\nBGS PU College Admin'),
      ('Request for Updated Info', 'Action Required: Update your Career/Education Progress', 'Dear {{name}},\n\nIt has been some time since you updated your career or education status in our college records. Please reply with details about your current employer, designation, or higher studies degree to help us keep our database accurate.\n\nBest regards,\nBGS PU College Admin'),
      ('Congratulations Message', 'Congratulations on your achievements!', 'Dear {{name}},\n\nWe heard about your recent success! The management and staff of BGS PU College congratulate you on this milestone and wish you the best for your future endeavors.\n\nBest regards,\nBGS PU College Admin')
    `);
    console.log('Seeded templates successfully.');
  }

  // Seed Audit Logs
  const auditCount = await db.get('SELECT COUNT(*) as count FROM audit_logs');
  if (auditCount.count === 0) {
    await db.run(`
      INSERT INTO audit_logs (username, role, action_type, details) VALUES
      ('system', 'Super Admin', 'SYSTEM_INITIALIZATION', 'BGS PU College database successfully initialized and seeded with default configuration.')
    `);
  }

  console.log('Database initialization check complete.');
}
