import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { db } from '../db.js';
import { logAudit } from '../server.js';
import { requireRole, isAuthenticated } from './auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer for profile photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/photos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'photo-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (PNG, JPG, JPEG, GIF, WEBP) are allowed.'));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Helper for Indian phone number validation
function validateIndianPhoneNumber(phone) {
  if (!phone) return false;
  // Matches 10-digit numbers, with optional +91 or 91 country code and optional spaces/dashes
  const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
  return phoneRegex.test(phone.trim());
}

// Helper for batch year validation
function validateBatchYear(year) {
  const currentYear = new Date().getFullYear();
  const yr = parseInt(year);
  return !isNaN(yr) && yr >= 2000 && yr <= currentYear;
}

// 1. LIST ALUMNI (supports search, pagination, filtering)
router.get('/', isAuthenticated, async (req, res) => {
  const { 
    search, 
    batch_year, 
    stream, 
    city, 
    state, 
    country, 
    include_archived = '0', // '0' = active only, '1' = archived only, '2' = all
    limit = 5000, 
    offset = 0 
  } = req.query;

  try {
    let query = 'SELECT * FROM alumni WHERE 1=1';
    const params = [];

    // Filter by archived status
    if (include_archived === '0') {
      query += ' AND is_archived = 0';
    } else if (include_archived === '1') {
      query += ' AND is_archived = 1';
    } // '2' includes everything

    // Search query (full-text search across name, institution, employer, notes)
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query += ' AND (name LIKE ? OR current_institution_employer LIKE ? OR degree_pursued LIKE ? OR notes LIKE ? OR roll_number LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filter fields
    if (batch_year) {
      query += ' AND batch_year = ?';
      params.push(parseInt(batch_year));
    }
    if (stream) {
      query += ' AND stream = ?';
      params.push(stream);
    }
    if (city) {
      query += ' AND city LIKE ?';
      params.push(`%${city}%`);
    }
    if (state) {
      query += ' AND state LIKE ?';
      params.push(`%${state}%`);
    }
    if (country) {
      query += ' AND country LIKE ?';
      params.push(`%${country}%`);
    }

    query += ' ORDER BY batch_year DESC, name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = await db.all(query, params);
    
    // Add last updated staleness indicator to each row
    const result = rows.map(alumnus => {
      const updatedTime = new Date(alumnus.updated_at).getTime();
      const diffTime = Date.now() - updatedTime;
      const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
      return {
        ...alumnus,
        staleness_months: diffMonths,
        requires_update_flag: diffMonths >= 12
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Fetch alumni error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET SINGLE ALUMNUS BY ID
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const alumnus = await db.get('SELECT * FROM alumni WHERE id = ?', [req.params.id]);
    if (!alumnus) {
      return res.status(404).json({ error: 'Alumnus profile not found' });
    }

    // Add staleness
    const updatedTime = new Date(alumnus.updated_at).getTime();
    const diffMonths = Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24 * 30.44));
    alumnus.staleness_months = diffMonths;
    alumnus.requires_update_flag = diffMonths >= 12;

    res.json(alumnus);
  } catch (error) {
    console.error('Fetch alumnus details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. ADD NEW ALUMNUS (Admin or Super Admin only)
router.post('/', requireRole(['Super Admin', 'Admin']), upload.single('photo'), async (req, res) => {
  const {
    name, dob, gender, batch_year, stream, roll_number,
    current_institution_employer, degree_pursued, city, state, country,
    mobile, email, secondary_contact, linkedin_url, notes,
    bypassDuplicateCheck = 'false'
  } = req.body;

  // Validation - only name and batch_year are truly required
  if (!name || !batch_year) {
    return res.status(400).json({ error: 'Name and Batch Year are required fields.' });
  }

  if (!validateBatchYear(batch_year)) {
    return res.status(400).json({ error: `Batch year must be between 2000 and ${new Date().getFullYear()}.` });
  }

  if (mobile && mobile.trim() && !validateIndianPhoneNumber(mobile)) {
    return res.status(400).json({ error: 'Invalid contact mobile number. Must be a valid 10-digit Indian number.' });
  }

  try {
    // Check Roll Number uniqueness only if roll_number is provided
    if (roll_number && roll_number.trim()) {
      const existingRoll = await db.get('SELECT id FROM alumni WHERE roll_number = ?', [roll_number.trim()]);
      if (existingRoll) {
        return res.status(400).json({ error: `Roll number ${roll_number} is already assigned to another profile.` });
      }
    }

    // Duplicate Detection (Name + Batch Year + Stream)
    if (bypassDuplicateCheck !== 'true') {
      const duplicate = await db.get(
      'SELECT id, name, batch_year, stream FROM alumni WHERE name = ? AND batch_year = ? AND is_archived = 0',
        [name.trim(), parseInt(batch_year)]
      );
      if (duplicate) {
        return res.status(409).json({
          duplicateDetected: true,
          message: `Duplicate Profile Alert: A record for '${name}' already exists in Batch ${batch_year} (${stream}).`
        });
      }
    }

    const photo_path = req.file ? `/uploads/photos/${req.file.filename}` : '';
    const username = req.session.user.username;

    const insertRes = await db.run(`
      INSERT INTO alumni (
        name, dob, gender, batch_year, stream, roll_number, 
        current_institution_employer, degree_pursued, city, state, country, 
        mobile, email, secondary_contact, linkedin_url, photo_path, notes, is_archived, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
      name.trim(), dob || '', gender || '', parseInt(batch_year), stream || '', (roll_number && roll_number.trim()) ? roll_number.trim() : null,
      current_institution_employer || '', degree_pursued || '', city || '', state || '', country || 'India',
      (mobile && mobile.trim()) ? mobile.trim() : '', (email && email.trim()) ? email.trim() : '', secondary_contact || '', linkedin_url || '', photo_path, notes || '', username
    ]);

    const alumnusId = insertRes.lastID;
    await logAudit(username, req.session.user.role, 'CREATE_ALUMNI', `Created alumnus record: ${name}${roll_number ? ' (Roll: ' + roll_number + ')' : ''}`);
    
    res.status(201).json({ message: 'Alumnus profile created successfully', id: alumnusId });
  } catch (error) {
    console.error('Add alumnus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. EDIT ALUMNUS PROFILE (Admin or Super Admin only)
router.put('/:id', requireRole(['Super Admin', 'Admin']), upload.single('photo'), async (req, res) => {
  const alumnusId = req.params.id;
  const {
    name, dob, gender, batch_year, stream, roll_number,
    current_institution_employer, degree_pursued, city, state, country,
    mobile, email, secondary_contact, linkedin_url, notes
  } = req.body;

  // Validation - only name and batch_year are truly required
  if (!name || !batch_year) {
    return res.status(400).json({ error: 'Name and Batch Year are required fields.' });
  }

  if (!validateBatchYear(batch_year)) {
    return res.status(400).json({ error: `Batch year must be between 2000 and ${new Date().getFullYear()}.` });
  }

  if (mobile && mobile.trim() && !validateIndianPhoneNumber(mobile)) {
    return res.status(400).json({ error: 'Invalid contact mobile number. Must be a valid 10-digit Indian number.' });
  }

  try {
    const existing = await db.get('SELECT * FROM alumni WHERE id = ?', [alumnusId]);
    if (!existing) {
      return res.status(404).json({ error: 'Alumnus profile not found' });
    }

    // Check roll number uniqueness for other profiles (only if provided)
    if (roll_number && roll_number.trim()) {
      const dupRoll = await db.get('SELECT id FROM alumni WHERE roll_number = ? AND id != ?', [roll_number.trim(), alumnusId]);
      if (dupRoll) {
        return res.status(400).json({ error: `Roll number ${roll_number} is already in use by another profile.` });
      }
    }

    let photo_path = existing.photo_path;
    if (req.file) {
      // Delete old photo if it exists
      if (existing.photo_path) {
        const oldPath = path.join(__dirname, '..', existing.photo_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      photo_path = `/uploads/photos/${req.file.filename}`;
    }

    const username = req.session.user.username;

    await db.run(`
      UPDATE alumni SET 
        name = ?, dob = ?, gender = ?, batch_year = ?, stream = ?, roll_number = ?, 
        current_institution_employer = ?, degree_pursued = ?, city = ?, state = ?, country = ?, 
        mobile = ?, email = ?, secondary_contact = ?, linkedin_url = ?, photo_path = ?, notes = ?, 
        updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?
    `, [
      name.trim(), dob || '', gender || '', parseInt(batch_year), stream || '', (roll_number && roll_number.trim()) ? roll_number.trim() : null,
      current_institution_employer || '', degree_pursued || '', city || '', state || '', country || 'India',
      (mobile && mobile.trim()) ? mobile.trim() : '', (email && email.trim()) ? email.trim() : '', secondary_contact || '', linkedin_url || '', photo_path, notes || '', username,
      alumnusId
    ]);

    await logAudit(username, req.session.user.role, 'EDIT_ALUMNI', `Updated alumnus record: ${name} (ID: ${alumnusId})`);
    
    res.json({ message: 'Alumnus profile updated successfully' });
  } catch (error) {
    console.error('Update alumnus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. ARCHIVE ALUMNUS (Super Admin only - Admin cannot delete/archive records)
router.post('/:id/archive', requireRole(['Super Admin']), async (req, res) => {
  const alumnusId = req.params.id;

  try {
    const existing = await db.get('SELECT name FROM alumni WHERE id = ?', [alumnusId]);
    if (!existing) {
      return res.status(404).json({ error: 'Alumnus profile not found' });
    }

    await db.run('UPDATE alumni SET is_archived = 1, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [
      req.session.user.username,
      alumnusId
    ]);

    await logAudit(req.session.user.username, req.session.user.role, 'ARCHIVE_ALUMNI', `Soft deleted/archived alumnus: ${existing.name} (ID: ${alumnusId})`);
    res.json({ message: 'Alumnus profile archived successfully' });
  } catch (error) {
    console.error('Archive alumnus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. RESTORE ALUMNUS (Super Admin only)
router.post('/:id/restore', requireRole(['Super Admin']), async (req, res) => {
  const alumnusId = req.params.id;

  try {
    const existing = await db.get('SELECT name FROM alumni WHERE id = ?', [alumnusId]);
    if (!existing) {
      return res.status(404).json({ error: 'Alumnus profile not found' });
    }

    await db.run('UPDATE alumni SET is_archived = 0, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?', [
      req.session.user.username,
      alumnusId
    ]);

    await logAudit(req.session.user.username, req.session.user.role, 'RESTORE_ALUMNI', `Restored alumnus: ${existing.name} (ID: ${alumnusId})`);
    res.json({ message: 'Alumnus profile restored successfully' });
  } catch (error) {
    console.error('Restore alumnus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. EXPORT SELECTED ALUMNI TO PDF (Super Admin, Admin, and Viewer can export)
router.post('/export/pdf', requireRole(['Super Admin', 'Admin', 'Viewer']), async (req, res) => {
  const { alumni_ids, template = 'full', confidential = false, layout = 'page-per-record', sections = {} } = req.body;

  if (!alumni_ids || !Array.isArray(alumni_ids) || alumni_ids.length === 0) {
    return res.status(400).json({ error: 'Please select at least one alumnus profile to export.' });
  }

  // Limit export size as per NFR
  if (alumni_ids.length > 50) {
    return res.status(400).json({ error: 'Exports are limited to a maximum of 50 profiles per document.' });
  }

  try {
    const username = req.session.user.username;
    
    // Fetch alumni profiles
    const placeholders = alumni_ids.map(() => '?').join(',');
    const alumniList = await db.all(`SELECT * FROM alumni WHERE id IN (${placeholders}) ORDER BY name ASC`, alumni_ids);

    if (alumniList.length === 0) {
      return res.status(404).json({ error: 'No profiles found to export.' });
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true
    });

    const filename = `BGS_Alumni_Export_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    doc.pipe(res);

    for (let index = 0; index < alumniList.length; index++) {
      const a = alumniList[index];
      
      if (layout === 'page-per-record' && index > 0) {
        doc.addPage();
      } else if (layout === 'condensed' && index > 0) {
        doc.moveDown(1);
        doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1);
      }

      const isStartOfPage = layout === 'page-per-record' || index === 0 || doc.y < 120;
      if (isStartOfPage) {
        doc.rect(40, 40, 60, 50).fillColor('#1E3A8A').fill();
        doc.fillColor('#FFFFFF').fontSize(14).text('BGS', 45, 52, { width: 50, align: 'center' });
        doc.fontSize(8).text('PU College', 45, 68, { width: 50, align: 'center' });

        doc.fillColor('#1E3A8A').fontSize(16).text('BGS POLYTECHNIC & PU COLLEGE', 115, 40, { bold: true });
        doc.fillColor('#4B5563').fontSize(9).text('Affiliated to PU Board Karnataka | Instituted for Academic Excellence', 115, 58);
        doc.text('Sri Adichunchanagiri Kshetra, Bengaluru, Karnataka - 560060', 115, 70);
        doc.text('Email: info@bgspucollege.edu.in | Web: www.bgspucollege.edu.in', 115, 82);

        doc.strokeColor('#1E3A8A').lineWidth(1.5).moveTo(40, 98).lineTo(555, 98).stroke();
        doc.moveDown(2);
      }

      const currentY = doc.y;
      doc.fillColor('#1E3A8A').fontSize(13).text(`${a.name.toUpperCase()} (Roll: ${a.roll_number})`, 40, currentY, { bold: true });
      
      if (a.is_archived) {
        doc.fillColor('#EF4444').fontSize(10).text('[ ARCHIVED RECORD ]', 450, currentY, { align: 'right' });
      }

      doc.moveDown(0.5);

      const showPersonal = template === 'full' || template === 'summary' || sections.personal;
      const showContact = template === 'full' || template === 'summary' || sections.contact;
      const showMilestones = template === 'full' || template === 'milestones' || sections.milestones;
      const showInteractions = template === 'full' || sections.interactions;

      if (showPersonal) {
        doc.fillColor('#374151').fontSize(10).text('PERSONAL DETAILS', 40, doc.y, { underline: true, bold: true });
        doc.moveDown(0.3);
        
        const details = [
          ['Gender:', a.gender, 'Date of Birth:', a.dob],
          ['Batch Year:', `${a.batch_year}`, 'Stream:', a.stream],
          ['Residence:', `${a.city}, ${a.state}, ${a.country}`, 'Status:', a.is_archived ? 'Archived' : 'Active']
        ];

        let startY = doc.y;
        details.forEach(row => {
          doc.fillColor('#4B5563').fontSize(9).text(row[0], 45, startY, { bold: true });
          doc.fillColor('#1F2937').text(row[1], 120, startY);
          
          doc.fillColor('#4B5563').text(row[2], 280, startY, { bold: true });
          doc.fillColor('#1F2937').text(row[3], 380, startY);
          startY += 15;
        });

        doc.y = startY + 5;
        doc.moveDown(0.5);
      }

      if (showContact) {
        doc.fillColor('#374151').fontSize(10).text('CONTACT INFORMATION', 40, doc.y, { underline: true, bold: true });
        doc.moveDown(0.3);

        const contacts = [
          ['Primary Mobile:', a.mobile, 'Primary Email:', a.email],
          ['Secondary:', a.secondary_contact || 'N/A', 'LinkedIn URL:', a.linkedin_url || 'N/A']
        ];

        let startY = doc.y;
        contacts.forEach(row => {
          doc.fillColor('#4B5563').fontSize(9).text(row[0], 45, startY, { bold: true });
          doc.fillColor('#1F2937').text(row[1], 120, startY);
          
          doc.fillColor('#4B5563').text(row[2], 280, startY, { bold: true });
          doc.fillColor('#1F2937').text(row[3], 380, startY);
          startY += 15;
        });

        doc.y = startY + 5;
        doc.moveDown(0.5);
      }

      if (template === 'full' && a.notes) {
        doc.fillColor('#374151').fontSize(9).text('Staff Notes (Internal):', 40, doc.y, { bold: true });
        doc.fillColor('#4B5563').fontSize(8.5).text(a.notes, 45, doc.y + 10, { width: 500 });
        doc.moveDown(2);
      }

      if (showMilestones) {
        const milestones = await db.all('SELECT * FROM milestones WHERE alumnus_id = ? ORDER BY field3 DESC', [a.id]);
        
        doc.fillColor('#374151').fontSize(10).text('ACADEMIC & PROFESSIONAL PROGRESSION', 40, doc.y, { underline: true, bold: true });
        doc.moveDown(0.4);

        if (milestones.length === 0) {
          doc.fillColor('#6B7280').fontSize(9).text('No milestone milestones recorded for this alumnus.', 45, doc.y);
          doc.moveDown(1);
        } else {
          for (const m of milestones) {
            if (doc.y > 700) {
              doc.addPage();
            }
            
            doc.fillColor('#1E3A8A').fontSize(9.5).text(`[${m.type.toUpperCase()}] — ${m.field1}`, 45, doc.y, { bold: true });
            
            let desc = '';
            if (m.type === 'Education') {
              desc = `Institution: ${m.field2} | Year: ${m.field3} | Grade: ${m.field4}`;
            } else if (m.type === 'Professional') {
              desc = `Role/Designation: ${m.field2} | Joined: ${m.field3} | Status: ${m.field4}`;
            } else if (m.type === 'Competitive Exam') {
              desc = `Authority: ${m.field2} | Year: ${m.field3} | Outcome: ${m.field4}`;
            } else if (m.type === 'Achievement') {
              desc = `Award/Detail: ${m.field2} | Date: ${m.field3} | Remarks: ${m.field4}`;
            }
            
            doc.fillColor('#4B5563').fontSize(8.5).text(desc, 55, doc.y + 10);
            doc.y += 20;
          }
          doc.moveDown(0.5);
        }
      }

      if (showInteractions) {
        const meetings = await db.all(`
          SELECT m.title, m.datetime, m.format, m.status 
          FROM meetings m 
          JOIN meeting_alumni ma ON m.id = ma.meeting_id 
          WHERE ma.alumnus_id = ? 
          ORDER BY m.datetime DESC
        `, [a.id]);

        const comms = await db.all(`
          SELECT c.type, c.datetime, c.subject, c.response_received 
          FROM communications c 
          JOIN communication_alumni ca ON c.id = ca.communication_id 
          WHERE ca.alumnus_id = ? 
          ORDER BY c.datetime DESC
        `, [a.id]);

        if (meetings.length > 0 || comms.length > 0) {
          doc.fillColor('#374151').fontSize(10).text('INTERACTIONS & COMMUNICATIONS HISTORY', 40, doc.y, { underline: true, bold: true });
          doc.moveDown(0.4);

          for (const mt of meetings) {
            if (doc.y > 700) doc.addPage();
            doc.fillColor('#059669').fontSize(8.5).text(`Meeting: ${mt.title} (${mt.format})`, 45, doc.y, { bold: true });
            doc.fillColor('#4B5563').text(`Scheduled: ${mt.datetime} | Status: ${mt.status}`, 55, doc.y + 10);
            doc.y += 20;
          }

          for (const cm of comms) {
            if (doc.y > 700) doc.addPage();
            doc.fillColor('#D97706').fontSize(8.5).text(`Sent ${cm.type.toUpperCase()}: ${cm.subject}`, 45, doc.y, { bold: true });
            doc.fillColor('#4B5563').text(`Date: ${cm.datetime} | Response: ${cm.response_received}`, 55, doc.y + 10);
            doc.y += 20;
          }
          doc.moveDown(0.5);
        }
      }
    }

    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = range.start; i < range.start + totalPages; i++) {
      doc.switchToPage(i);

      if (confidential) {
        doc.save();
        doc.fillColor('#EF4444')
           .opacity(0.06)
           .fontSize(60)
           .rotate(-45, { origin: [297.5, 421] })
           .text('CONFIDENTIAL RECORD', 80, 390, { width: 450, align: 'center', bold: true });
        doc.restore();
      }

      doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(40, 800).lineTo(555, 800).stroke();
      doc.fillColor('#9CA3AF').fontSize(8);
      
      const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      doc.text(`Generated: ${dateStr} | Staff ID: ${username}`, 40, 808);
      doc.text(`Page ${i + 1} of ${totalPages}`, 450, 808, { width: 105, align: 'right' });
    }

    doc.end();

    await logAudit(
      username,
      req.session.user.role,
      'EXPORT_PDF',
      `Exported PDF report containing ${alumniList.length} alumni profiles. Filename: ${filename}`
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Internal server error during PDF generation' });
  }
});

export default router;
