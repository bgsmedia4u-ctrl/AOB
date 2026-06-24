import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { logAudit } from '../server.js';
import { requireRole, isAuthenticated } from './auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer for milestone attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/attachments');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'attach-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDFs, Word docs, and images (PNG, JPG, JPEG) are allowed as attachments.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// 1. GET ALL MILESTONES FOR A SPECIFIC ALUMNUS
router.get('/alumnus/:id', isAuthenticated, async (req, res) => {
  const alumnusId = req.params.id;
  try {
    const rows = await db.all('SELECT * FROM milestones WHERE alumnus_id = ? ORDER BY field3 DESC, created_at DESC', [alumnusId]);
    res.json(rows);
  } catch (error) {
    console.error('Fetch milestones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. ADD MILESTONE (Admin or Super Admin only)
router.post('/alumnus/:id', requireRole(['Super Admin', 'Admin']), upload.single('attachment'), async (req, res) => {
  const alumnusId = req.params.id;
  const { type, field1, field2, field3, field4 } = req.body;

  if (!type || !field1) {
    return res.status(400).json({ error: 'Milestone type and primary field (field1) are required.' });
  }

  try {
    const alumnus = await db.get('SELECT name FROM alumni WHERE id = ?', [alumnusId]);
    if (!alumnus) {
      return res.status(404).json({ error: 'Alumnus profile not found.' });
    }

    const attachment_path = req.file ? `/uploads/attachments/${req.file.filename}` : '';
    const username = req.session.user.username;

    const insertRes = await db.run(`
      INSERT INTO milestones (alumnus_id, type, field1, field2, field3, field4, attachment_path, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [alumnusId, type, field1.trim(), field2, field3, field4, attachment_path, username]);

    // Update the parent alumnus updated_at timestamp to refresh staleness
    await db.run('UPDATE alumni SET updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [username, alumnusId]);

    await logAudit(
      username,
      req.session.user.role,
      'ADD_MILESTONE',
      `Added ${type} milestone to ${alumnus.name}: ${field1} (ID: ${insertRes.lastID})`
    );

    res.status(201).json({ message: 'Milestone added successfully', id: insertRes.lastID });
  } catch (error) {
    console.error('Add milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. EDIT MILESTONE (Admin or Super Admin only)
router.put('/:id', requireRole(['Super Admin', 'Admin']), upload.single('attachment'), async (req, res) => {
  const milestoneId = req.params.id;
  const { type, field1, field2, field3, field4 } = req.body;

  if (!type || !field1) {
    return res.status(400).json({ error: 'Milestone type and primary field are required.' });
  }

  try {
    const existing = await db.get('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
    if (!existing) {
      return res.status(404).json({ error: 'Milestone record not found.' });
    }

    const alumnus = await db.get('SELECT name FROM alumni WHERE id = ?', [existing.alumnus_id]);

    let attachment_path = existing.attachment_path;
    if (req.file) {
      // Delete old attachment if it exists
      if (existing.attachment_path) {
        const oldPath = path.join(__dirname, '..', existing.attachment_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      attachment_path = `/uploads/attachments/${req.file.filename}`;
    }

    const username = req.session.user.username;

    await db.run(`
      UPDATE milestones SET 
        type = ?, field1 = ?, field2 = ?, field3 = ?, field4 = ?, attachment_path = ?, 
        updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?
    `, [type, field1.trim(), field2, field3, field4, attachment_path, username, milestoneId]);

    // Update parent alumnus update timestamp
    await db.run('UPDATE alumni SET updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [username, existing.alumnus_id]);

    await logAudit(
      username,
      req.session.user.role,
      'EDIT_MILESTONE',
      `Updated ${type} milestone for ${alumnus ? alumnus.name : 'Unknown'}: ${field1} (ID: ${milestoneId})`
    );

    res.json({ message: 'Milestone updated successfully' });
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. DELETE MILESTONE (Admin or Super Admin only)
router.delete('/:id', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const milestoneId = req.params.id;

  try {
    const existing = await db.get('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
    if (!existing) {
      return res.status(404).json({ error: 'Milestone record not found.' });
    }

    const alumnus = await db.get('SELECT name FROM alumni WHERE id = ?', [existing.alumnus_id]);

    // Delete attachment file if exists
    if (existing.attachment_path) {
      const filePath = path.join(__dirname, '..', existing.attachment_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const username = req.session.user.username;

    await db.run('DELETE FROM milestones WHERE id = ?', [milestoneId]);
    
    // Update parent alumnus update timestamp
    await db.run('UPDATE alumni SET updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [username, existing.alumnus_id]);

    await logAudit(
      username,
      req.session.user.role,
      'DELETE_MILESTONE',
      `Deleted ${existing.type} milestone for ${alumnus ? alumnus.name : 'Unknown'}: ${existing.field1} (ID: ${milestoneId})`
    );

    res.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
