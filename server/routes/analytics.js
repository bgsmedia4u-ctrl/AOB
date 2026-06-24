import express from 'express';
import { db } from '../db.js';
import { logAudit } from '../server.js';
import { requireRole, isAuthenticated } from './auth.js';

const router = express.Router();

// 1. GET ANALYTICS PANELS (with batch year range filters)
router.get('/dashboard', isAuthenticated, async (req, res) => {
  const { start_year, end_year } = req.query;

  try {
    let whereClause = ' WHERE is_archived = 0';
    const params = [];

    if (start_year) {
      whereClause += ' AND batch_year >= ?';
      params.push(parseInt(start_year));
    }
    if (end_year) {
      whereClause += ' AND batch_year <= ?';
      params.push(parseInt(end_year));
    }

    // 1. Total Alumni Count
    const totalCountRes = await db.get(`SELECT COUNT(*) as count FROM alumni ${whereClause}`, params);
    const totalCount = totalCountRes ? totalCountRes.count : 0;

    // 2. Stream-wise distribution (count and percentage)
    const streamDistribution = await db.all(`
      SELECT stream, COUNT(*) as count 
      FROM alumni 
      ${whereClause} 
      GROUP BY stream
    `, params);

    const streamBreakdown = streamDistribution.map(s => ({
      stream: s.stream,
      count: s.count,
      percentage: totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : '0.0'
    }));

    // 3. Competitive exam outcome summary (NEET, JEE, CET, UPSC, etc. - qualified counts)
    // We query milestones of type 'Competitive Exam' and check if the outcome contains "Qualified" or "qualified"
    // Wait, let's join with alumni to respect the batch range filters
    const examOutcomes = await db.all(`
      SELECT m.field1 as exam_name, COUNT(*) as count 
      FROM milestones m
      JOIN alumni a ON m.alumnus_id = a.id
      ${whereClause.replace('is_archived', 'a.is_archived')} 
        AND m.type = 'Competitive Exam' 
        AND (m.field4 LIKE '%Qualified%' OR m.field4 LIKE '%Pass%' OR m.field4 LIKE '%qualified%')
      GROUP BY m.field1
      ORDER BY count DESC
    `, params);

    // 4. Higher Education Destinations (Top 10 institutions by count)
    // We fetch current_institution_employer where degree_pursued is present, or milestones of type 'Education'
    const educationDestinations = await db.all(`
      SELECT m.field2 as institution, COUNT(DISTINCT m.alumnus_id) as count
      FROM milestones m
      JOIN alumni a ON m.alumnus_id = a.id
      ${whereClause.replace('is_archived', 'a.is_archived')}
        AND m.type = 'Education'
        AND m.field2 IS NOT NULL AND m.field2 != ''
      GROUP BY m.field2
      ORDER BY count DESC
      LIMIT 10
    `, params);

    // 5. Employment Distribution (Top 10 employers)
    const employmentDestinations = await db.all(`
      SELECT m.field1 as employer, COUNT(DISTINCT m.alumnus_id) as count
      FROM milestones m
      JOIN alumni a ON m.alumnus_id = a.id
      ${whereClause.replace('is_archived', 'a.is_archived')}
        AND m.type = 'Professional'
        AND m.field1 IS NOT NULL AND m.field1 != ''
      GROUP BY m.field1
      ORDER BY count DESC
      LIMIT 10
    `, params);

    // 6. Data Completeness Indicator
    // Percentage of active profiles with at least 1 milestone log
    const completeProfilesRes = await db.get(`
      SELECT COUNT(DISTINCT a.id) as count 
      FROM alumni a
      JOIN milestones m ON a.id = m.alumnus_id
      ${whereClause.replace('is_archived', 'a.is_archived')}
    `, params);

    const completeCount = completeProfilesRes ? completeProfilesRes.count : 0;
    const dataCompletenessPercentage = totalCount > 0 
      ? ((completeCount / totalCount) * 100).toFixed(1)
      : '0.0';

    res.json({
      total_alumni: totalCount,
      stream_breakdown: streamBreakdown,
      competitive_exams: examOutcomes,
      top_institutions: educationDestinations,
      top_employers: employmentDestinations,
      data_completeness: {
        total_profiles: totalCount,
        complete_profiles: completeCount,
        percentage: dataCompletenessPercentage
      }
    });
  } catch (error) {
    console.error('Fetch analytics dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. SAVE FILTER PRESET
router.post('/presets', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const { name, filters } = req.body;

  if (!name || !filters) {
    return res.status(400).json({ error: 'Preset name and filter settings are required.' });
  }

  try {
    const filtersStr = typeof filters === 'string' ? filters : JSON.stringify(filters);
    
    // Check uniqueness
    const existing = await db.get('SELECT id FROM report_presets WHERE name = ?', [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: `A preset named '${name}' already exists.` });
    }

    const insertRes = await db.run(
      'INSERT INTO report_presets (name, filters) VALUES (?, ?)',
      [name.trim(), filtersStr]
    );

    await logAudit(
      req.session.user.username,
      req.session.user.role,
      'SAVE_PRESET',
      `Saved dashboard report preset: '${name}'`
    );

    res.status(201).json({ message: 'Preset saved successfully', id: insertRes.lastID });
  } catch (error) {
    console.error('Save preset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. LIST ALL PRESETS
router.get('/presets', isAuthenticated, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM report_presets ORDER BY name ASC');
    const result = rows.map(r => ({
      id: r.id,
      name: r.name,
      filters: JSON.parse(r.filters),
      created_at: r.created_at
    }));
    res.json(result);
  } catch (error) {
    console.error('Fetch presets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. DELETE PRESET
router.delete('/presets/:id', requireRole(['Super Admin', 'Admin']), async (req, res) => {
  const presetId = req.params.id;

  try {
    const existing = await db.get('SELECT name FROM report_presets WHERE id = ?', [presetId]);
    if (!existing) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    await db.run('DELETE FROM report_presets WHERE id = ?', [presetId]);
    await logAudit(
      req.session.user.username,
      req.session.user.role,
      'DELETE_PRESET',
      `Deleted report preset: '${existing.name}'`
    );

    res.json({ message: 'Preset deleted successfully.' });
  } catch (error) {
    console.error('Delete preset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
