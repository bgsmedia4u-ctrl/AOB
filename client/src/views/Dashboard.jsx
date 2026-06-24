import React, { useState, useEffect } from 'react';
import { BarChart3, Filter, Save, Trash2, FileSpreadsheet, Plus, X, Search } from 'lucide-react';

export default function Dashboard({ user, triggerToast }) {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startYear, setStartYear] = useState('2000');
  const [endYear, setEndYear] = useState(new Date().getFullYear().toString());
  
  // Presets state
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);

  // Quick-add milestone modal state
  const [quickAddType, setQuickAddType] = useState(null); // 'Education', 'Competitive Exam', 'Professional'
  const [quickAddForm, setQuickAddForm] = useState({ field1: '', field2: '', field3: '', field4: '' });
  const [alumniList, setAlumniList] = useState([]);
  const [alumniSearch, setAlumniSearch] = useState('');
  const [selectedAlumnusId, setSelectedAlumnusId] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Generate valid years range (2000 to current year)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2000; y--) {
    years.push(y.toString());
  }

  useEffect(() => {
    fetchAnalytics();
    fetchPresets();
  }, []);

  const fetchAnalytics = async (sYear = startYear, eYear = endYear) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (sYear) queryParams.append('start_year', sYear);
      if (eYear) queryParams.append('end_year', eYear);

      const res = await fetch(`/api/analytics/dashboard?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      } else {
        triggerToast('Failed to fetch analytics statistics.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error while loading dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/analytics/presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.error('Fetch presets error:', err);
    }
  };

  const fetchAlumniForQuickAdd = async (searchTerm = '') => {
    try {
      const queryParams = new URLSearchParams({ limit: '50' });
      if (searchTerm) queryParams.append('search', searchTerm);
      const res = await fetch(`/api/alumni?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlumniList(data);
      }
    } catch (err) {
      console.error('Fetch alumni for quick-add error:', err);
    }
  };

  const handleApplyFilter = (e) => {
    e?.preventDefault();
    setSelectedPreset('');
    fetchAnalytics(startYear, endYear);
  };

  const handleApplyPreset = (presetId) => {
    setSelectedPreset(presetId);
    if (!presetId) return;

    const preset = presets.find(p => p.id === parseInt(presetId));
    if (preset && preset.filters) {
      const sY = preset.filters.start_year || '2000';
      const eY = preset.filters.end_year || currentYear.toString();
      setStartYear(sY);
      setEndYear(eY);
      fetchAnalytics(sY, eY);
      triggerToast(`Applied report preset: '${preset.name}'`);
    }
  };

  const handleSavePreset = async (e) => {
    e.preventDefault();
    if (!newPresetName.trim()) {
      triggerToast('Preset name cannot be empty.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/analytics/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPresetName.trim(),
          filters: { start_year: startYear, end_year: endYear }
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`Preset '${newPresetName}' saved successfully.`);
        setNewPresetName('');
        setShowPresetModal(false);
        fetchPresets();
      } else {
        triggerToast(data.error || 'Failed to save preset.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error connecting to presets API.', 'error');
    }
  };

  const handleDeletePreset = async (presetId, name) => {
    if (!confirm(`Are you sure you want to delete the report preset '${name}'?`)) return;

    try {
      const res = await fetch(`/api/analytics/presets/${presetId}`, { method: 'DELETE' });
      if (res.ok) {
        triggerToast(`Preset deleted successfully.`);
        if (selectedPreset === presetId.toString()) {
          setSelectedPreset('');
        }
        fetchPresets();
      } else {
        triggerToast('Failed to delete preset.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error during preset deletion.', 'error');
    }
  };

  // Export current dashboard metrics as CSV
  const handleExportCSV = () => {
    if (!analyticsData) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `BGS PU College Alumni Analytics Report\n`;
    csvContent += `Filters: Batch Year Range (${startYear} - ${endYear})\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    csvContent += `METRIC,VALUE\n`;
    csvContent += `Total Alumni,${analyticsData.total_alumni}\n`;
    csvContent += `Data Completeness (%),${analyticsData.data_completeness?.percentage}%\n\n`;

    csvContent += `STREAM DISTRIBUTION\nStream,Count,Percentage\n`;
    analyticsData.stream_breakdown?.forEach(s => {
      csvContent += `${s.stream},${s.count},${s.percentage}%\n`;
    });
    csvContent += `\n`;

    csvContent += `COMPETITIVE EXAMS QUALIFIED OUTCOMES\nExam,Count\n`;
    analyticsData.competitive_exams?.forEach(e => {
      csvContent += `"${e.exam_name}",${e.count}\n`;
    });
    csvContent += `\n`;

    csvContent += `TOP HIGHER EDUCATION INSTITUTIONS\nInstitution,Alumni Count\n`;
    analyticsData.top_institutions?.forEach(inst => {
      csvContent += `"${inst.institution}",${inst.count}\n`;
    });
    csvContent += `\n`;

    csvContent += `TOP EMPLOYERS\nEmployer,Alumni Count\n`;
    analyticsData.top_employers?.forEach(emp => {
      csvContent += `"${emp.employer}",${emp.count}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BGS_Alumni_Analytics_${startYear}_${endYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Analytics exported as CSV.');
  };

  // Quick-add milestone handlers
  const openQuickAddModal = (milestoneType) => {
    setQuickAddType(milestoneType);
    setSelectedAlumnusId('');
    setAlumniSearch('');
    setAlumniList([]);
    setSavingMilestone(false);

    if (milestoneType === 'Education') {
      setQuickAddForm({ field1: '', field2: '', field3: currentYear.toString(), field4: '' });
    } else if (milestoneType === 'Competitive Exam') {
      setQuickAddForm({ field1: '', field2: '', field3: currentYear.toString(), field4: 'Qualified' });
    } else if (milestoneType === 'Professional') {
      setQuickAddForm({ field1: '', field2: '', field3: currentYear.toString(), field4: 'Current' });
    }

    fetchAlumniForQuickAdd();
  };

  const handleAlumniSearchChange = (val) => {
    setAlumniSearch(val);
    fetchAlumniForQuickAdd(val);
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();

    if (!selectedAlumnusId) {
      triggerToast('Please select an alumnus to link this entry to.', 'error');
      return;
    }
    if (!quickAddForm.field1.trim()) {
      triggerToast('The primary field is required.', 'error');
      return;
    }

    setSavingMilestone(true);
    try {
      const formData = new FormData();
      formData.append('type', quickAddType);
      formData.append('field1', quickAddForm.field1.trim());
      formData.append('field2', quickAddForm.field2.trim());
      formData.append('field3', quickAddForm.field3.trim());
      formData.append('field4', quickAddForm.field4.trim());

      const res = await fetch(`/api/milestones/alumnus/${selectedAlumnusId}`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(`${quickAddType} entry added successfully.`);
        setQuickAddType(null);
        fetchAnalytics(startYear, endYear);
      } else {
        triggerToast(data.error || 'Failed to add entry.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error saving entry.', 'error');
    } finally {
      setSavingMilestone(false);
    }
  };

  // Helper: get field labels based on milestone type
  const getFieldLabels = (type) => {
    if (type === 'Education') {
      return { field1: 'Degree / Course Name', field2: 'Institution Name', field3: 'Year', field4: 'Grade / CGPA' };
    } else if (type === 'Competitive Exam') {
      return { field1: 'Exam Name (e.g., NEET, JEE, CET)', field2: 'Authority / Board', field3: 'Year', field4: 'Outcome (Qualified / Rank)' };
    } else if (type === 'Professional') {
      return { field1: 'Company / Employer', field2: 'Role / Designation', field3: 'Year Joined', field4: 'Status (Current / Former)' };
    }
    return { field1: 'Field 1', field2: 'Field 2', field3: 'Field 3', field4: 'Field 4' };
  };

  const getModalTitle = (type) => {
    if (type === 'Education') return 'Add Higher Education Entry';
    if (type === 'Competitive Exam') return 'Add Competitive Exam Qualifier';
    if (type === 'Professional') return 'Add Employer / Placement Entry';
    return 'Add Entry';
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <BarChart3 size={16} />
          Batch & Stream Analytics Dashboard
        </div>
        <div className="workspace-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>REPORTS PRESETS:</span>
            <select 
              className="form-control" 
              style={{ width: '160px' }} 
              value={selectedPreset} 
              onChange={(e) => handleApplyPreset(e.target.value)}
            >
              <option value="">-- Select Saved Preset --</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedPreset && user.role !== 'Viewer' && (
              <button 
                type="button" 
                className="btn btn-danger btn-xs" 
                title="Delete preset"
                onClick={() => {
                  const p = presets.find(x => x.id === parseInt(selectedPreset));
                  if (p) handleDeletePreset(p.id, p.name);
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <button 
            type="button" 
            className="btn" 
            onClick={handleExportCSV} 
            disabled={loading || !analyticsData}
          >
            <FileSpreadsheet size={13} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="workspace-content">
        {/* Filter Bar */}
        <form className="control-bar" onSubmit={handleApplyFilter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} style={{ color: '#64748b' }} />
            <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>FILTERS:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px' }}>Batch From:</span>
            <select 
              className="form-control filter-year"
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px' }}>To:</span>
            <select 
              className="form-control filter-year"
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>Apply Filters</button>
          
          {user.role !== 'Viewer' && (
            <button 
              type="button" 
              className="btn" 
              onClick={() => setShowPresetModal(true)}
              style={{ marginLeft: 'auto' }}
            >
              <Save size={13} />
              Save View Preset
            </button>
          )}
        </form>

        {loading ? (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <p style={{ fontFamily: 'monospace', color: '#64748b' }}>COMPUTING AGGREGATES AND DESTINATION RANKS...</p>
          </div>
        ) : analyticsData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Top Row: Total Cards & Completeness */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="analytics-card">
                <div className="analytics-card-title">TOTAL REGISTERED ALUMNI</div>
                <div className="analytics-number">{analyticsData.total_alumni}</div>
                <div className="analytics-metric-lbl">Active & traceable institutional records</div>
              </div>

              <div className="analytics-card">
                <div className="analytics-card-title">PROFILE COMPLETENESS RATE</div>
                <div className="completeness-gauge">
                  <div className="gauge-circle">
                    {analyticsData.data_completeness?.percentage}%
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>
                      {analyticsData.data_completeness?.complete_profiles} of {analyticsData.data_completeness?.total_profiles}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Alumni with active progress milestones</div>
                  </div>
                </div>
              </div>

              <div className="analytics-card">
                <div className="analytics-card-title">REPORT RANGE</div>
                <div className="analytics-number" style={{ fontSize: '20px', paddingTop: '6px' }}>
                  {startYear} — {endYear}
                </div>
                <div className="analytics-metric-lbl" style={{ marginTop: '12px' }}>Aggregating {parseInt(endYear) - parseInt(startYear) + 1} academic batches</div>
              </div>
            </div>

            {/* Middle Row: Stream Distributions & Exams */}
            <div className="analytics-grid">
              
              {/* Stream Distribution */}
              <div className="analytics-card" style={{ gridColumn: 'span 2' }}>
                <div className="analytics-card-title">STREAM-WISE ENROLLMENT DISTRIBUTION</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', flexGrow: 1 }}>
                  {analyticsData.stream_breakdown?.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '11px' }}>No records in the filtered range.</p>
                  ) : (
                    analyticsData.stream_breakdown?.map(s => (
                      <div key={s.stream} className="bar-chart-row">
                        <div className="bar-chart-label">
                          <span style={{ fontWeight: 600 }}>{s.stream || '(No Stream)'}</span>
                          <span style={{ color: '#475569' }}>{s.count} alumni ({s.percentage}%)</span>
                        </div>
                        <div className="bar-chart-track">
                          <div className="bar-chart-fill" style={{ width: `${s.percentage}%` }}></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Competitive Exams */}
              <div className="analytics-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div className="analytics-card-title" style={{ margin: 0 }}>COMPETITIVE EXAM QUALIFIERS</div>
                  {user.role !== 'Viewer' && (
                    <button 
                      type="button" 
                      className="btn btn-xs btn-primary" 
                      onClick={() => openQuickAddModal('Competitive Exam')}
                      style={{ padding: '2px 8px', fontSize: '10px' }}
                    >
                      <Plus size={10} /> Add
                    </button>
                  )}
                </div>
                <div style={{ overflowY: 'auto', flexGrow: 1 }}>
                  {analyticsData.competitive_exams?.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '11.5px', marginTop: '12px' }}>No competitive exam qualifiers logged in this batch range.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '4px 0', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Exam</th>
                          <th style={{ padding: '4px 0', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Qualifiers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.competitive_exams?.map(e => (
                          <tr key={e.exam_name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 0', fontWeight: 500 }}>{e.exam_name}</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: 'var(--accent-color)' }}>{e.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Row: Higher Ed & Employment */}
            <div className="analytics-grid">
              
              {/* Higher Education */}
              <div className="analytics-card" style={{ gridColumn: 'span 1.5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div className="analytics-card-title" style={{ margin: 0 }}>TOP HIGHER EDUCATION DESTINATIONS (TOP 10)</div>
                  {user.role !== 'Viewer' && (
                    <button 
                      type="button" 
                      className="btn btn-xs btn-primary" 
                      onClick={() => openQuickAddModal('Education')}
                      style={{ padding: '2px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}
                    >
                      <Plus size={10} /> Add
                    </button>
                  )}
                </div>
                <div style={{ overflowY: 'auto' }}>
                  {analyticsData.top_institutions?.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '11px' }}>No academic progression milestones registered.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <tbody>
                        {analyticsData.top_institutions?.map((inst, idx) => (
                          <tr key={inst.institution} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 4px', color: '#94a3b8', width: '24px' }}>#{idx + 1}</td>
                            <td style={{ padding: '6px 4px', fontWeight: 500 }}>{inst.institution}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{inst.count} alumni</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Employment */}
              <div className="analytics-card" style={{ gridColumn: 'span 1.5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div className="analytics-card-title" style={{ margin: 0 }}>TOP CORPORATE EMPLOYERS / INDUSTRIES (TOP 10)</div>
                  {user.role !== 'Viewer' && (
                    <button 
                      type="button" 
                      className="btn btn-xs btn-primary" 
                      onClick={() => openQuickAddModal('Professional')}
                      style={{ padding: '2px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}
                    >
                      <Plus size={10} /> Add
                    </button>
                  )}
                </div>
                <div style={{ overflowY: 'auto' }}>
                  {analyticsData.top_employers?.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '11px' }}>No corporate placement milestones registered.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <tbody>
                        {analyticsData.top_employers?.map((emp, idx) => (
                          <tr key={emp.employer} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '6px 4px', color: '#94a3b8', width: '24px' }}>#{idx + 1}</td>
                            <td style={{ padding: '6px 4px', fontWeight: 500 }}>{emp.employer}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{emp.count} alumni</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>No data loaded.</div>
        )}
      </div>

      {/* Save Preset View Modal */}
      {showPresetModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSavePreset} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <div className="modal-title">Save Dashboard Report Preset</div>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">Preset Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g., Medicine Alumni 2020-2024"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  required
                />
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                This will save the current filter view of batch range ({startYear} - {endYear}) for quick retrieval.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setShowPresetModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Preset</button>
            </div>
          </form>
        </div>
      )}

      {/* Quick-Add Milestone Modal */}
      {quickAddType && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleQuickAddSubmit} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">{getModalTitle(quickAddType)}</div>
              <button type="button" className="btn btn-xs" onClick={() => setQuickAddType(null)} style={{ border: 'none', padding: '4px' }}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Alumnus Selector */}
              <div className="form-group">
                <label className="form-label required">Select Alumnus</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Search by name to find alumnus..."
                    value={alumniSearch}
                    onChange={(e) => handleAlumniSearchChange(e.target.value)}
                    style={{ paddingLeft: '28px' }}
                  />
                  <Search size={12} style={{ position: 'absolute', left: '8px', top: '9px', color: '#94a3b8' }} />
                </div>
                <select 
                  className="form-control" 
                  value={selectedAlumnusId} 
                  onChange={(e) => setSelectedAlumnusId(e.target.value)}
                  required
                  size={4}
                  style={{ marginTop: '6px', fontSize: '11px', height: 'auto' }}
                >
                  <option value="">— Click to select an alumnus —</option>
                  {alumniList.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.batch_year ? `(Batch ${a.batch_year})` : ''} {a.stream ? `— ${a.stream}` : ''}
                    </option>
                  ))}
                </select>
                {alumniList.length === 0 && (
                  <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    No alumni found. Add alumni records first in the Alumni Records section.
                  </p>
                )}
              </div>

              {/* Dynamic Fields */}
              <div className="form-group">
                <label className="form-label required">{getFieldLabels(quickAddType).field1}</label>
                <input 
                  type="text" className="form-control"
                  placeholder={getFieldLabels(quickAddType).field1}
                  value={quickAddForm.field1}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, field1: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{getFieldLabels(quickAddType).field2}</label>
                <input 
                  type="text" className="form-control"
                  placeholder={getFieldLabels(quickAddType).field2}
                  value={quickAddForm.field2}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, field2: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">{getFieldLabels(quickAddType).field3}</label>
                  <input 
                    type="text" className="form-control"
                    value={quickAddForm.field3}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, field3: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{getFieldLabels(quickAddType).field4}</label>
                  <input 
                    type="text" className="form-control"
                    value={quickAddForm.field4}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, field4: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setQuickAddType(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingMilestone}>
                {savingMilestone ? 'Saving...' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
