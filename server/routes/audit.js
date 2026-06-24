import express from 'express';
import { db } from '../db.js';
import { requireRole } from './auth.js';

const router = express.Router();

// GET ALL AUDIT LOGS (Super Admin only - access check enforced via requireRole)
router.get('/', requireRole(['Super Admin']), async (req, res) => {
  const { username, action_type, search, limit = 100, offset = 0 } = req.query;

  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (username) {
      query += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }
    
    if (action_type) {
      query += ' AND action_type = ?';
      params.push(action_type);
    }

    if (search) {
      const term = `%${search}%`;
      query += ' AND (details LIKE ? OR action_type LIKE ? OR username LIKE ?)';
      params.push(term, term, term);
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await db.all(query, params);

    // Get total count for pagination indicators
    let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (username) {
      countQuery += ' AND username LIKE ?';
      countParams.push(`%${username}%`);
    }
    if (action_type) {
      countQuery += ' AND action_type = ?';
      countParams.push(action_type);
    }
    if (search) {
      const term = `%${search}%`;
      countQuery += ' AND (details LIKE ? OR action_type LIKE ? OR username LIKE ?)';
      countParams.push(term, term, term);
    }

    const countRes = await db.get(countQuery, countParams);
    const total = countRes ? countRes.count : 0;

    res.json({
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      logs
    });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
