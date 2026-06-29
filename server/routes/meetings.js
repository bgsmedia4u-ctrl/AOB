import express from 'express';
import { db } from '../db.js';
import { logAudit } from '../server.js';
import { requireRole, isAuthenticated } from './auth.js';

const router = express.Router();

// 1. GET ALL MEETINGS (with query filters)
router.get('/', isAuthenticated, async (req, res) => {
  const { start_date, end_date, alumnus_id } = req.query;

  try {
    let query = 'SELECT m.* FROM meetings m';
    const params = [];

    if (alumnus_id) {
      query += ' JOIN meeting_alumni ma ON m.id = ma.meeting_id WHERE ma.alumnus_id = ?';
      params.push(parseInt(alumnus_id));
    } else {
      query += ' WHERE 1=1';
    }

    if (start_date) {
      query += ' AND m.datetime >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND m.datetime <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY m.datetime ASC';

    const meetings = await db.all(query, params);

    // Batch-fetch all linked alumni in a single JOIN (avoids N+1)
    const meetingIds = meetings.map(m => m.id);
    let allLinkedAlumni = [];
    if (meetingIds.length > 0) {
      const placeholders = meetingIds.map(() => '?').join(',');
      allLinkedAlumni = await db.all(`
        SELECT ma.meeting_id, a.id, a.name, a.batch_year, a.stream, a.email 
        FROM alumni a 
        JOIN meeting_alumni ma ON a.id = ma.alumnus_id 
        WHERE ma.meeting_id IN (${placeholders})
      `, meetingIds);
    }

    // Group alumni by meeting_id in memory
    const alumniByMeeting = {};
    for (const row of allLinkedAlumni) {
      if (!alumniByMeeting[row.meeting_id]) alumniByMeeting[row.meeting_id] = [];
      alumniByMeeting[row.meeting_id].push({
        id: row.id, name: row.name, batch_year: row.batch_year,
        stream: row.stream, email: row.email
      });
    }

    const result = meetings.map(m => ({
      ...m,
      linked_alumni: alumniByMeeting[m.id] || []
    }));

    res.json(result);
  } catch (error) {
    console.error('Fetch meetings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. CREATE A MEETING (Admin/Super Admin only)
router.post('/', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { title, datetime, format, staff_responsible, notes, status = 'scheduled', recurrence = 'none', alumni_ids = [] } = req.body;

  if (!title || !datetime || !format || !staff_responsible) {
    return res.status(400).json({ error: 'Missing required meeting details (title, datetime, format, staff_responsible).' });
  }

  try {
    const username = req.session.user.username;

    // Insert meeting
    const meetRes = await db.run(`
      INSERT INTO meetings (title, datetime, format, staff_responsible, notes, status, recurrence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [title.trim(), datetime, format, staff_responsible, notes, status, recurrence]);

    const meetingId = meetRes.lastID;

    // Link alumni
    if (alumni_ids && Array.isArray(alumni_ids) && alumni_ids.length > 0) {
      for (const aid of alumni_ids) {
        await db.run('INSERT INTO meeting_alumni (meeting_id, alumnus_id) VALUES (?, ?)', [meetingId, aid]);
      }
    }

    await logAudit(
      username,
      req.session.user.role,
      'SCHEDULE_MEETING',
      `Scheduled meeting '${title}' on ${datetime} with ${alumni_ids.length} alumni.`
    );

    res.status(201).json({ message: 'Meeting scheduled successfully', id: meetingId });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. EDIT MEETING DETAILS (Admin/Super Admin only)
router.put('/:id', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const meetingId = req.params.id;
  const { title, datetime, format, staff_responsible, notes, status, outcome, recurrence, alumni_ids } = req.body;

  if (!title || !datetime || !format || !staff_responsible || !status) {
    return res.status(400).json({ error: 'Missing required fields for meeting update.' });
  }

  try {
    const existing = await db.get('SELECT * FROM meetings WHERE id = ?', [meetingId]);
    if (!existing) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const username = req.session.user.username;

    // Update meeting details
    await db.run(`
      UPDATE meetings SET 
        title = ?, datetime = ?, format = ?, staff_responsible = ?, 
        notes = ?, status = ?, outcome = ?, recurrence = ?
      WHERE id = ?
    `, [title.trim(), datetime, format, staff_responsible, notes, status, outcome, recurrence, meetingId]);

    // Update linked alumni relations (clear existing links and re-add)
    if (alumni_ids && Array.isArray(alumni_ids)) {
      await db.run('DELETE FROM meeting_alumni WHERE meeting_id = ?', [meetingId]);
      for (const aid of alumni_ids) {
        await db.run('INSERT INTO meeting_alumni (meeting_id, alumnus_id) VALUES (?, ?)', [meetingId, aid]);
      }
    }

    await logAudit(
      username,
      req.session.user.role,
      'EDIT_MEETING',
      `Updated meeting '${title}' (ID: ${meetingId}), status: ${status}.`
    );

    res.json({ message: 'Meeting details updated successfully' });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. CANCEL/DELETE MEETING (Admin/Super Admin only)
router.delete('/:id', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const meetingId = req.params.id;

  try {
    const existing = await db.get('SELECT title FROM meetings WHERE id = ?', [meetingId]);
    if (!existing) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const username = req.session.user.username;

    await db.run('DELETE FROM meetings WHERE id = ?', [meetingId]);
    await logAudit(
      username,
      req.session.user.role,
      'DELETE_MEETING',
      `Deleted meeting: ${existing.title} (ID: ${meetingId})`
    );

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. GET MEETINGS REQUIRING REMINDERS WITHIN 24 HOURS (Simulated notifications check)
router.get('/reminders', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const nowStr = now.toISOString().slice(0, 16);
    const futureStr = twentyFourHoursLater.toISOString().slice(0, 16);

    // Find scheduled meetings occurring within the next 24 hours
    const upcoming = await db.all(`
      SELECT * FROM meetings 
      WHERE status = 'scheduled' AND datetime >= ? AND datetime <= ?
      ORDER BY datetime ASC
    `, [nowStr, futureStr]);

    res.json(upcoming);
  } catch (error) {
    console.error('Reminder check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
