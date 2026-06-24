import express from 'express';
import { db } from '../db.js';
import { logAudit } from '../server.js';
import { requireRole, isAuthenticated } from './auth.js';

const router = express.Router();

// 1. GET ALL COMMUNICATION LOGS (with filters)
router.get('/logs', isAuthenticated, async (req, res) => {
  const { type, start_date, end_date, staff_initiator, response_received, alumnus_id } = req.query;

  try {
    let query = 'SELECT c.* FROM communications c';
    const params = [];

    if (alumnus_id) {
      query += ' JOIN communication_alumni ca ON c.id = ca.communication_id WHERE ca.alumnus_id = ?';
      params.push(parseInt(alumnus_id));
    } else {
      query += ' WHERE 1=1';
    }

    if (type) {
      query += ' AND c.type = ?';
      params.push(type);
    }
    if (start_date) {
      query += ' AND c.datetime >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND c.datetime <= ?';
      params.push(end_date);
    }
    if (staff_initiator) {
      query += ' AND c.staff_initiator LIKE ?';
      params.push(`%${staff_initiator}%`);
    }
    if (response_received) {
      query += ' AND c.response_received = ?';
      params.push(response_received);
    }

    query += ' ORDER BY c.datetime DESC, c.id DESC';

    const logs = await db.all(query, params);

    // Fetch recipients for each communication log
    const result = [];
    for (const log of logs) {
      const recipients = await db.all(`
        SELECT a.id, a.name, a.batch_year, a.stream, a.email
        FROM alumni a
        JOIN communication_alumni ca ON a.id = ca.alumnus_id
        WHERE ca.communication_id = ?
      `, [log.id]);

      result.push({
        ...log,
        recipients
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Fetch communication logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. CREATE A MANUAL COMMUNICATION LOG (Admin/Super Admin only)
router.post('/logs', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { type, datetime, subject, message, response_received = 'no', response_summary, alumni_ids = [] } = req.body;

  if (!type || !subject || !message) {
    return res.status(400).json({ error: 'Missing required log fields (type, subject, message).' });
  }

  try {
    const username = req.session.user.username;
    const dt = datetime || new Date().toISOString().slice(0, 16);

    const commRes = await db.run(`
      INSERT INTO communications (type, datetime, subject, message, staff_initiator, response_received, response_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [type, dt, subject.trim(), message.trim(), username, response_received, response_summary]);

    const communicationId = commRes.lastID;

    // Link recipients
    if (alumni_ids && Array.isArray(alumni_ids) && alumni_ids.length > 0) {
      for (const aid of alumni_ids) {
        await db.run('INSERT INTO communication_alumni (communication_id, alumnus_id) VALUES (?, ?)', [communicationId, aid]);
      }
    }

    await logAudit(
      username,
      req.session.user.role,
      'LOG_COMMUNICATION',
      `Manually logged '${type}' communication: '${subject}' with ${alumni_ids.length} alumni.`
    );

    res.status(201).json({ message: 'Communication logged successfully', id: communicationId });
  } catch (error) {
    console.error('Create communication log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. SEND TEMPLATED EMAILS (Simulated Dispatcher & Auto-logger)
router.post('/send-templated', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { template_id, alumni_ids = [] } = req.body;

  if (!template_id || !alumni_ids || alumni_ids.length === 0) {
    return res.status(400).json({ error: 'Please select a template and at least one recipient alumnus.' });
  }

  try {
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [template_id]);
    if (!template) {
      return res.status(404).json({ error: 'Selected email template not found.' });
    }

    const username = req.session.user.username;
    
    // Fetch alumni details for placeholder replacement
    const placeholders = [];
    const idList = alumni_ids.map(() => '?').join(',');
    const recipients = await db.all(`SELECT id, name, batch_year, email FROM alumni WHERE id IN (${idList})`, alumni_ids);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No valid alumni found for selected IDs.' });
    }

    // Process and dispatch each email (simulation)
    const logDetails = [];
    
    // Create master communication log
    const commRes = await db.run(`
      INSERT INTO communications (type, datetime, subject, message, staff_initiator, response_received)
      VALUES ('email', CURRENT_TIMESTAMP, ?, ?, ?, 'pending')
    `, [template.subject, `[Template: ${template.name}]\n\n${template.body}`, username]);

    const communicationId = commRes.lastID;

    // Link all recipients to the communication log
    for (const r of recipients) {
      await db.run('INSERT INTO communication_alumni (communication_id, alumnus_id) VALUES (?, ?)', [communicationId, r.id]);
      
      // Simulate rendering template placeholders for logs/email stdout
      let renderedBody = template.body
        .replace(/{{name}}/g, r.name)
        .replace(/{{batch}}/g, r.batch_year);
      
      logDetails.push({
        to: r.email,
        name: r.name,
        subject: template.subject,
        body: renderedBody
      });
    }

    // Write the simulated email dispatch log to disk for staff diagnostics
    const emailDispatchPath = './server/simulated_emails.log';
    const dispatchEntry = `
========================================
TIMESTAMP: ${new Date().toISOString()}
SENDER (STAFF): ${username} (Role: ${req.session.user.role})
COMMUNICATION ID: ${communicationId}
TEMPLATE: ${template.name}
----------------------------------------
DISPATCHED EMAILS:
${JSON.stringify(logDetails, null, 2)}
========================================
\n`;
    
    fs.appendFileSync(emailDispatchPath, dispatchEntry);

    await logAudit(
      username,
      req.session.user.role,
      'SEND_EMAIL_TEMPLATE',
      `Sent template '${template.name}' to ${recipients.length} alumni. Simulated mail output appended to server logs.`
    );

    res.json({ 
      message: `Simulated dispatch successful. Emails sent to ${recipients.length} recipients.`,
      communicationId 
    });
  } catch (error) {
    console.error('Send templated email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. GET ALL TEMPLATES
router.get('/templates', isAuthenticated, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM templates ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Fetch templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. UPDATE TEMPLATE (Admin / Super Admin only)
router.put('/templates/:id', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { subject, body } = req.body;
  const templateId = req.params.id;

  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body contents cannot be empty.' });
  }

  try {
    const existing = await db.get('SELECT name FROM templates WHERE id = ?', [templateId]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db.run(
      'UPDATE templates SET subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [subject.trim(), body.trim(), templateId]
    );

    await logAudit(
      req.session.user.username,
      req.session.user.role,
      'UPDATE_TEMPLATE',
      `Modified communication template: '${existing.name}'`
    );

    res.json({ message: 'Template updated successfully.' });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
