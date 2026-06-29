import express from 'express';
import { db } from '../db.js';
import { logAudit } from '../server.js';
import { requireRole, isAuthenticated } from './auth.js';
import { sendEmail } from '../gmail-config.js';

const router = express.Router();

// Helper: encode email to base64url for Gmail API
function buildRawEmail(to, subject, body) {
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body
  ];
  const emailString = emailLines.join('\n');
  return Buffer.from(emailString)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

    // Batch-fetch all recipients in a single JOIN (avoids N+1)
    const logIds = logs.map(l => l.id);
    let allRecipients = [];
    if (logIds.length > 0) {
      const placeholders = logIds.map(() => '?').join(',');
      allRecipients = await db.all(`
        SELECT ca.communication_id, a.id, a.name, a.batch_year, a.stream, a.email
        FROM alumni a
        JOIN communication_alumni ca ON a.id = ca.alumnus_id
        WHERE ca.communication_id IN (${placeholders})
      `, logIds);
    }

    // Group recipients by communication_id in memory
    const recipientsByLog = {};
    for (const row of allRecipients) {
      if (!recipientsByLog[row.communication_id]) recipientsByLog[row.communication_id] = [];
      recipientsByLog[row.communication_id].push({
        id: row.id, name: row.name, batch_year: row.batch_year,
        stream: row.stream, email: row.email
      });
    }

    const result = logs.map(log => ({
      ...log,
      recipients: recipientsByLog[log.id] || []
    }));

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

    // Create master communication log
    const commRes = await db.run(`
      INSERT INTO communications (type, datetime, subject, message, staff_initiator, response_received)
      VALUES ('email', CURRENT_TIMESTAMP, ?, ?, ?, 'pending')
    `, [template.subject, `[Template: ${template.name}]\n\n${template.body}`, username]);

    const communicationId = commRes.lastID;

    let sentCount = 0;
    const skipped = [];

    // Send real Gmail to each recipient
    for (const r of recipients) {
      await db.run('INSERT INTO communication_alumni (communication_id, alumnus_id) VALUES (?, ?)', [communicationId, r.id]);

      if (!r.email || !r.email.includes('@')) {
        skipped.push(r.name);
        continue;
      }

      const renderedBody = template.body
        .replace(/{{name}}/g, r.name)
        .replace(/{{batch}}/g, r.batch_year);

      const rawEmail = buildRawEmail(r.email, template.subject, renderedBody);

      try {
        await sendEmail({
          to: r.email,
          subject: template.subject,
          body: renderedBody,
          rawEmail
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed to send email to ${r.email}:`, emailErr.message);
        skipped.push(r.name);
      }
    }

    await logAudit(
      username,
      req.session.user.role,
      'SEND_EMAIL_TEMPLATE',
      `Sent template '${template.name}' via Gmail to ${sentCount} alumni. Skipped: ${skipped.length}.`
    );

    res.json({ 
      message: `Email dispatch complete. Sent: ${sentCount}, Skipped (no email): ${skipped.length}.`,
      communicationId,
      skipped
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

// 6. CREATE TEMPLATE (Admin / Super Admin only)
router.post('/templates', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { name, subject, body } = req.body;

  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'Name, subject, and body contents are all required.' });
  }

  try {
    const existing = await db.get('SELECT id FROM templates WHERE name = ?', [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: `A template named '${name.trim()}' already exists.` });
    }

    const insertRes = await db.run(
      'INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)',
      [name.trim(), subject.trim(), body.trim()]
    );

    const templateId = insertRes.lastID;

    await logAudit(
      req.session.user.username,
      req.session.user.role,
      'CREATE_TEMPLATE',
      `Created communication template: '${name.trim()}'`
    );

    res.status(201).json({ message: 'Template created successfully.', id: templateId });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. DELETE TEMPLATE (Admin / Super Admin only)
router.delete('/templates/:id', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const templateId = req.params.id;

  try {
    const existing = await db.get('SELECT name FROM templates WHERE id = ?', [templateId]);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db.run('DELETE FROM templates WHERE id = ?', [templateId]);

    await logAudit(
      req.session.user.username,
      req.session.user.role,
      'DELETE_TEMPLATE',
      `Deleted communication template: '${existing.name}'`
    );

    res.json({ message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. SEND CUSTOM (COMPOSED) EMAIL directly to selected alumni (Admin/Super Admin only)
router.post('/send-custom-email', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { subject, body, alumni_ids = [] } = req.body;

  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and email body are required.' });
  }
  if (!alumni_ids || alumni_ids.length === 0) {
    return res.status(400).json({ error: 'Please select at least one alumnus recipient.' });
  }

  try {
    const username = req.session.user.username;

    // Fetch recipient alumni
    const idList = alumni_ids.map(() => '?').join(',');
    const recipients = await db.all(
      `SELECT id, name, batch_year, email FROM alumni WHERE id IN (${idList})`,
      alumni_ids
    );

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No valid alumni found for selected IDs.' });
    }

    // Create master communication log entry
    const commRes = await db.run(`
      INSERT INTO communications (type, datetime, subject, message, staff_initiator, response_received)
      VALUES ('email', CURRENT_TIMESTAMP, ?, ?, ?, 'pending')
    `, [subject.trim(), body.trim(), username]);

    const communicationId = commRes.lastID;

    let sentCount = 0;
    const skipped = [];

    for (const r of recipients) {
      // Link to communication log
      await db.run(
        'INSERT INTO communication_alumni (communication_id, alumnus_id) VALUES (?, ?)',
        [communicationId, r.id]
      );

      if (!r.email || !r.email.includes('@')) {
        skipped.push(r.name);
        continue;
      }

      // Replace {{name}} and {{batch}} placeholders in body
      const renderedBody = body
        .replace(/{{name}}/g, r.name)
        .replace(/{{batch}}/g, r.batch_year);

      try {
        await sendEmail({ to: r.email, subject: subject.trim(), body: renderedBody });
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed to send email to ${r.email}:`, emailErr.message);
        skipped.push(r.name);
      }
    }

    await logAudit(
      username,
      req.session.user.role,
      'SEND_CUSTOM_EMAIL',
      `Sent custom email: "${subject}" to ${sentCount} alumni. Skipped (no email): ${skipped.length}.`
    );

    res.json({
      message: `Email dispatch complete. Sent: ${sentCount}, Skipped (no email): ${skipped.length}.`,
      communicationId,
      sentCount,
      skipped
    });
  } catch (error) {
    console.error('Send custom email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. LOG WHATSAPP OUTREACH (Admin/Super Admin only)
// Opens a WhatsApp web link on the client side; this endpoint logs the attempt
router.post('/log-whatsapp', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { message, alumni_ids = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required.' });
  }
  if (!alumni_ids || alumni_ids.length === 0) {
    return res.status(400).json({ error: 'Please select at least one alumnus recipient.' });
  }

  try {
    const username = req.session.user.username;
    const subject = `WhatsApp Outreach — ${new Date().toLocaleDateString('en-IN')}`;

    const commRes = await db.run(`
      INSERT INTO communications (type, datetime, subject, message, staff_initiator, response_received)
      VALUES ('WhatsApp', CURRENT_TIMESTAMP, ?, ?, ?, 'pending')
    `, [subject, message.trim(), username]);

    const communicationId = commRes.lastID;

    // Fetch recipients and link them
    const idList = alumni_ids.map(() => '?').join(',');
    const recipients = await db.all(
      `SELECT id, name, mobile FROM alumni WHERE id IN (${idList})`,
      alumni_ids
    );

    for (const r of recipients) {
      await db.run(
        'INSERT INTO communication_alumni (communication_id, alumnus_id) VALUES (?, ?)',
        [communicationId, r.id]
      );
    }

    await logAudit(
      username,
      req.session.user.role,
      'WHATSAPP_OUTREACH',
      `Initiated WhatsApp outreach to ${recipients.length} alumni. Message: "${message.substring(0, 60)}..."`
    );

    // Return recipient mobile numbers so the client can open wa.me links
    res.json({
      message: 'WhatsApp outreach logged successfully.',
      communicationId,
      recipients: recipients.map(r => ({
        id: r.id,
        name: r.name,
        mobile: r.mobile
      }))
    });
  } catch (error) {
    console.error('Log WhatsApp outreach error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

