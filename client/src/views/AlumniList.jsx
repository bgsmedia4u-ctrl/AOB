import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  RotateCcw, 
  Upload, 
  FileText, 
  Download, 
  Mail, 
  ChevronRight, 
  ChevronDown,
  UserPlus, 
  Check, 
  FileDown,
  Calendar,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

export default function AlumniList({ user, triggerToast }) {
  // Directory list state
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null); // alumnus object for Detail Drawer
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Selection state
  const [selectedAlumniIds, setSelectedAlumniIds] = useState([]);
  const [selectAllPage, setSelectAllPage] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [stream, setStream] = useState('');
  const [city, setCity] = useState('');
  const [includeArchived, setIncludeArchived] = useState('0'); // '0' = Active, '1' = Archived, '2' = All
  const [staleOnly, setStaleOnly] = useState(false);

  // Detail Drawer Tabs
  const [activeTab, setActiveTab] = useState('profile');

  // Milestone list & forms state
  const [milestones, setMilestones] = useState([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneType, setMilestoneType] = useState('Education');
  const [milestoneField1, setMilestoneField1] = useState('');
  const [milestoneField2, setMilestoneField2] = useState('');
  const [milestoneField3, setMilestoneField3] = useState('');
  const [milestoneField4, setMilestoneField4] = useState('');
  const [milestoneFile, setMilestoneFile] = useState(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);

  // Alumnus profile form state
  const [profileForm, setProfileForm] = useState({
    name: '', dob: '', gender: 'Male', batch_year: '', stream: 'PCMB', roll_number: '',
    current_institution_employer: '', degree_pursued: '', city: '', state: '', country: 'India',
    mobile: '', email: '', secondary_contact: '', linkedin_url: '', notes: ''
  });
  const [profilePhoto, setProfilePhoto] = useState(null);

  // Export PDF config modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState('full');
  const [pdfConfidential, setPdfConfidential] = useState(false);
  const [pdfLayout, setPdfLayout] = useState('page-per-record');
  const [pdfSections, setPdfSections] = useState({
    personal: true, contact: true, milestones: true, interactions: true, audit: true
  });
  const [exporting, setExporting] = useState(false);

  // Interactions tab state
  const [interactions, setInteractions] = useState([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  // Bulk Template Email Send state
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Add form - show more fields toggle
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Constants
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2000; y--) {
    years.push(y.toString());
  }

  useEffect(() => {
    fetchAlumni();
  }, [batchYear, stream, includeArchived, staleOnly]);

  // Load details whenever Drawer selection changes
  useEffect(() => {
    if (selectedRow) {
      if (activeTab === 'milestones') {
        fetchMilestones(selectedRow.id);
      } else if (activeTab === 'interactions') {
        fetchInteractions(selectedRow.id);
      }
    }
  }, [selectedRow, activeTab]);

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (batchYear) params.append('batch_year', batchYear);
      if (stream) params.append('stream', stream);
      if (city.trim()) params.append('city', city.trim());
      params.append('include_archived', includeArchived);

      const res = await fetch(`/api/alumni?${params.toString()}`);
      if (res.ok) {
        let data = await res.json();
        if (staleOnly) {
          data = data.filter(a => a.staleness_months >= 12);
        }
        setAlumni(data);
        
        // Reset checkbox Select All state
        setSelectAllPage(false);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error connecting to alumni database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAlumni();
  };

  const selectRow = (alumnus) => {
    setSelectedRow(alumnus);
    setIsEditing(false);
    setIsAdding(false);
    
    // Fill the profile form state
    setProfileForm({
      name: alumnus.name,
      dob: alumnus.dob,
      gender: alumnus.gender,
      batch_year: alumnus.batch_year.toString(),
      stream: alumnus.stream,
      roll_number: alumnus.roll_number,
      current_institution_employer: alumnus.current_institution_employer || '',
      degree_pursued: alumnus.degree_pursued || '',
      city: alumnus.city,
      state: alumnus.state,
      country: alumnus.country,
      mobile: alumnus.mobile,
      email: alumnus.email,
      secondary_contact: alumnus.secondary_contact || '',
      linkedin_url: alumnus.linkedin_url || '',
      notes: alumnus.notes || ''
    });
    setProfilePhoto(null);
    setActiveTab('profile');
  };

  const closeDrawer = () => {
    setSelectedRow(null);
    setIsEditing(false);
    setIsAdding(false);
  };

  const handleAddClick = () => {
    setSelectedRow(null);
    setIsEditing(false);
    setIsAdding(true);
    setProfilePhoto(null);
    setShowMoreFields(false);
    setProfileForm({
      name: '', dob: '', gender: '', batch_year: currentYear.toString(), stream: '', roll_number: '',
      current_institution_employer: '', degree_pursued: '', city: '', state: '', country: 'India',
      mobile: '', email: '', secondary_contact: '', linkedin_url: '', notes: ''
    });
  };

  // Checkbox interactions
  const handleCheckboxChange = (id) => {
    setSelectedAlumniIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAllPage = () => {
    if (selectAllPage) {
      // Unselect all alumni in current view
      const rowIds = alumni.map(a => a.id);
      setSelectedAlumniIds(prev => prev.filter(id => !rowIds.includes(id)));
      setSelectAllPage(false);
    } else {
      // Select all alumni in current view
      const rowIds = alumni.map(a => a.id);
      setSelectedAlumniIds(prev => {
        const unique = new Set([...prev, ...rowIds]);
        return Array.from(unique);
      });
      setSelectAllPage(true);
    }
  };

  const handleSelectAllMatching = () => {
    const rowIds = alumni.map(a => a.id);
    setSelectedAlumniIds(rowIds);
    setSelectAllPage(true);
    triggerToast(`Selected all ${rowIds.length} profiles matching current filters.`);
  };

  const handleClearSelection = () => {
    setSelectedAlumniIds([]);
    setSelectAllPage(false);
  };

  // Add / Edit Profile Save
  const handleSaveProfile = async (e, bypass = false) => {
    e.preventDefault();

    // Indian phone regex check (only if mobile is provided)
    const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
    if (profileForm.mobile && profileForm.mobile.trim() && !phoneRegex.test(profileForm.mobile.trim())) {
      triggerToast('Mobile number must be a valid 10-digit Indian number.', 'error');
      return;
    }

    const formData = new FormData();
    Object.keys(profileForm).forEach(key => {
      formData.append(key, profileForm[key]);
    });
    if (profilePhoto) {
      formData.append('photo', profilePhoto);
    }
    if (bypass) {
      formData.append('bypassDuplicateCheck', 'true');
    }

    try {
      const url = isAdding ? '/api/alumni' : `/api/alumni/${selectedRow.id}`;
      const method = isAdding ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        body: formData // multipart upload
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(isAdding ? 'Profile created successfully.' : 'Profile updated successfully.');
        setIsAdding(false);
        setIsEditing(false);
        fetchAlumni();
        if (selectedRow) {
          // Refresh details drawer
          const updatedRowRes = await fetch(`/api/alumni/${selectedRow.id}`);
          if (updatedRowRes.ok) {
            const updatedRow = await updatedRowRes.json();
            setSelectedRow(updatedRow);
          }
        }
      } else if (res.status === 409 && data.duplicateDetected) {
        // Show confirm box for duplicate
        if (confirm(`${data.message}\n\nDo you want to save this duplicate profile anyway?`)) {
          handleSaveProfile(e, true);
        }
      } else {
        triggerToast(data.error || 'Failed to save alumni profile.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error saving profile changes.', 'error');
    }
  };

  // Archive / Soft Delete Profile
  const handleArchive = async () => {
    if (!confirm(`Are you sure you want to soft delete/archive the profile of ${selectedRow.name}?`)) return;

    try {
      const res = await fetch(`/api/alumni/${selectedRow.id}/archive`, { method: 'POST' });
      if (res.ok) {
        triggerToast('Profile soft deleted (archived) successfully.');
        closeDrawer();
        fetchAlumni();
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to archive profile.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error while archiving.', 'error');
    }
  };

  // Restore Profile
  const handleRestore = async () => {
    try {
      const res = await fetch(`/api/alumni/${selectedRow.id}/restore`, { method: 'POST' });
      if (res.ok) {
        triggerToast('Profile restored to active records.');
        fetchAlumni();
        closeDrawer();
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to restore profile.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error while restoring.', 'error');
    }
  };

  // Milestones Timeline handlers
  const fetchMilestones = async (alumnusId) => {
    setLoadingMilestones(true);
    try {
      const res = await fetch(`/api/milestones/alumnus/${alumnusId}`);
      if (res.ok) {
        const data = await res.json();
        setMilestones(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMilestones(false);
    }
  };

  const handleAddMilestoneClick = () => {
    setEditingMilestoneId(null);
    setMilestoneType('Education');
    setMilestoneField1('');
    setMilestoneField2('');
    setMilestoneField3(currentYear.toString());
    setMilestoneField4('');
    setMilestoneFile(null);
    setShowMilestoneForm(true);
  };

  const handleEditMilestoneClick = (m) => {
    setEditingMilestoneId(m.id);
    setMilestoneType(m.type);
    setMilestoneField1(m.field1);
    setMilestoneField2(m.field2 || '');
    setMilestoneField3(m.field3 || '');
    setMilestoneField4(m.field4 || '');
    setMilestoneFile(null);
    setShowMilestoneForm(true);
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneField1.trim()) {
      triggerToast('Primary milestone field (field1) is mandatory.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('type', milestoneType);
    formData.append('field1', milestoneField1.trim());
    formData.append('field2', milestoneField2);
    formData.append('field3', milestoneField3);
    formData.append('field4', milestoneField4);
    if (milestoneFile) {
      formData.append('attachment', milestoneFile);
    }

    try {
      const url = editingMilestoneId 
        ? `/api/milestones/${editingMilestoneId}`
        : `/api/milestones/alumnus/${selectedRow.id}`;
      const method = editingMilestoneId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData
      });

      if (res.ok) {
        triggerToast(editingMilestoneId ? 'Milestone updated.' : 'Milestone added successfully.');
        setShowMilestoneForm(false);
        fetchMilestones(selectedRow.id);
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to save milestone.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error saving milestone entry.', 'error');
    }
  };

  const handleDeleteMilestone = async (id) => {
    if (!confirm('Are you sure you want to delete this progression milestone?')) return;
    try {
      const res = await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerToast('Milestone deleted.');
        fetchMilestones(selectedRow.id);
      } else {
        triggerToast('Failed to delete milestone.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Interactions tab handlers (Meetings & Comms history)
  const fetchInteractions = async (alumnusId) => {
    setLoadingInteractions(true);
    try {
      // Fetch meetings and communications associated with this alumnus
      const meetRes = await fetch(`/api/meetings?alumnus_id=${alumnusId}`);
      const commsRes = await fetch(`/api/communications/logs?alumnus_id=${alumnusId}`);
      
      if (meetRes.ok && commsRes.ok) {
        const meetings = await meetRes.json();
        const communications = await commsRes.json();
        
        // Combine and sort chronologically descending
        const combined = [
          ...meetings.map(m => ({ ...m, category: 'meeting' })),
          ...communications.map(c => ({ ...m, ...c, category: 'communication' }))
        ];
        
        combined.sort((a, b) => {
          const tA = new Date(a.datetime).getTime();
          const tB = new Date(b.datetime).getTime();
          return tB - tA;
        });

        setInteractions(combined);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInteractions(false);
    }
  };

  // PDF Export trigger
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/alumni/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumni_ids: selectedAlumniIds,
          template: pdfTemplate,
          confidential: pdfConfidential,
          layout: pdfLayout,
          sections: pdfSections
        })
      });

      if (res.ok) {
        // Download PDF
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        link.setAttribute('download', `BGS_Alumni_Export_${timestamp}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerToast(`PDF Report generated for ${selectedAlumniIds.length} profiles.`);
        setShowExportModal(false);
      } else {
        const errData = await res.json();
        triggerToast(errData.error || 'Failed to generate PDF export.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error during PDF document generation.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Bulk Email dispatcher trigger
  const openBulkEmailDialog = async () => {
    if (selectedAlumniIds.length === 0) {
      triggerToast('Please select recipients first.', 'error');
      return;
    }
    
    try {
      const res = await fetch('/api/communications/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0) setSelectedTemplateId(data[0].id.toString());
        setShowBulkEmailModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendBulkEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch('/api/communications/send-templated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: parseInt(selectedTemplateId),
          alumni_ids: selectedAlumniIds
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setShowBulkEmailModal(false);
        handleClearSelection();
      } else {
        triggerToast(data.error || 'Failed to dispatch templated emails.', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <FileText size={16} />
          Alumni Records Management Directory
        </div>
        <div className="workspace-actions">
          {user.role !== 'Viewer' && (
            <button className="btn btn-primary" onClick={handleAddClick}>
              <UserPlus size={13} />
              Add Alumnus
            </button>
          )}
        </div>
      </header>

      <div className="workspace-content" style={{ padding: '12px 16px', gap: '12px' }}>
        {/* Split Pane Layout */}
        <div className="split-pane">
          
          {/* LEFT: ALUMNI LIST VIEW */}
          <div className="pane-left">
            {/* Filter controls */}
            <form className="control-bar" onSubmit={handleSearchSubmit}>
              <div style={{ position: 'relative', flexGrow: 1, minWidth: '180px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search name, employer, notes..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '24px' }}
                />
                <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#64748b' }} />
              </div>

              <select 
                className="form-control filter-select"
                value={stream}
                onChange={(e) => setStream(e.target.value)}
              >
                <option value="">All Streams</option>
                <option value="PCMB">PCMB</option>
                <option value="PCMCs">PCMCs</option>
                <option value="Commerce">Commerce</option>
              </select>

              <select 
                className="form-control filter-year"
                value={batchYear}
                onChange={(e) => setBatchYear(e.target.value)}
              >
                <option value="">All Batches</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              <input 
                type="text" 
                className="form-control" 
                placeholder="City filter"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ width: '100px' }}
              />

              <select 
                className="form-control"
                value={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.value)}
                style={{ width: '110px' }}
              >
                <option value="0">Active Only</option>
                <option value="1">Archived Only</option>
                <option value="2">All Records</option>
              </select>

              {/* Stale Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={staleOnly}
                  onChange={(e) => setStaleOnly(e.target.checked)}
                />
                <span style={{ color: '#b91c1c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <AlertTriangle size={11} /> Stale Profile (&gt;12m)
                </span>
              </label>

              <button type="submit" className="btn btn-primary">Search</button>
            </form>

            {/* Selection Multi-options */}
            {selectedAlumniIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', padding: '6px 12px', borderBottom: '1px solid var(--border-light)', backgroundColor: '#eff6ff' }}>
                <span style={{ fontWeight: 600, color: '#1e3a8a', alignSelf: 'center', fontSize: '11px' }}>
                  {selectedAlumniIds.length} profiles selected
                </span>
                <button type="button" className="btn btn-xs" onClick={handleClearSelection}>Clear</button>
                <button type="button" className="btn btn-xs" onClick={handleSelectAllMatching}>Select All Matching Filter</button>
                <button type="button" className="btn btn-xs btn-primary" onClick={openBulkEmailDialog}>
                  <Mail size={11} /> Send Template Mail
                </button>
              </div>
            )}

            {/* Table wrapper */}
            <div className="table-container">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace' }}>RETRIEVING RECORDS...</div>
              ) : alumni.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No alumni records matching criteria found.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectAllPage} 
                          onChange={handleSelectAllPage} 
                        />
                      </th>
                      <th>Roll Number</th>
                      <th>Name</th>
                      <th>Batch</th>
                      <th>Stream</th>
                      <th>Current Status / Employer</th>
                      <th>City</th>
                      <th>Contact</th>
                      <th>Data Staleness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumni.map(a => {
                      const isRowSelectedInDrawer = selectedRow && selectedRow.id === a.id;
                      const isChecked = selectedAlumniIds.includes(a.id);
                      return (
                        <tr 
                          key={a.id} 
                          className={`${isRowSelectedInDrawer ? 'selected' : ''} ${a.is_archived ? 'archived' : ''}`}
                          onClick={() => selectRow(a)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => handleCheckboxChange(a.id)}
                            />
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.roll_number}</td>
                          <td style={{ fontWeight: 500, color: '#0f172a' }}>{a.name}</td>
                          <td>{a.batch_year}</td>
                          <td>{a.stream}</td>
                          <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.current_institution_employer || 'Not recorded'}
                          </td>
                          <td>{a.city}</td>
                          <td style={{ fontSize: '11px' }}>
                            <div>{a.mobile}</div>
                            <div style={{ color: '#64748b' }}>{a.email}</div>
                          </td>
                          <td>
                            {a.staleness_months >= 12 ? (
                              <span className="badge badge-archived" style={{ gap: '2px' }}>
                                <AlertTriangle size={10} /> {a.staleness_months}m Stale
                              </span>
                            ) : (
                              <span className="badge badge-active">{a.staleness_months}m Current</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT: DETAILS DRAWER / ADD PANEL */}
          {(selectedRow || isAdding) && (
            <div className="pane-right">
              <div className="pane-header">
                <div className="pane-title">
                  {isAdding ? 'Create Alumni Profile' : `${profileForm.name || 'Alumnus Profile'}`}
                </div>
                <button className="btn btn-xs" onClick={closeDrawer} style={{ border: 'none', padding: '4px' }}>
                  <X size={14} />
                </button>
              </div>

              {/* Show tabs only for existing alumnus details */}
              {!isAdding && (
                <div className="tab-container">
                  <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
                  <button className={`tab-btn ${activeTab === 'milestones' ? 'active' : ''}`} onClick={() => setActiveTab('milestones')}>Milestones</button>
                  <button className={`tab-btn ${activeTab === 'interactions' ? 'active' : ''}`} onClick={() => setActiveTab('interactions')}>Interactions</button>
                </div>
              )}

              <div className="pane-content">
                
                {/* PROFILE DETAILS TAB */}
                {((!isAdding && activeTab === 'profile') || isAdding) && (
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    
                    {/* Mode header (View vs Edit) */}
                    {!isAdding && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                        {user.role !== 'Viewer' && !isEditing && (
                          <button type="button" className="btn btn-xs" onClick={() => setIsEditing(true)}>
                            <Edit2 size={11} /> Edit Profile
                          </button>
                        )}
                        {user.role === 'Super Admin' && (
                          selectedRow.is_archived ? (
                            <button type="button" className="btn btn-xs btn-primary" onClick={handleRestore}>
                              <RotateCcw size={11} /> Restore Profile
                            </button>
                          ) : (
                            <button type="button" className="btn btn-xs btn-danger" onClick={handleArchive}>
                              <Trash2 size={11} /> Archive Profile
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {/* ========== PRIMARY FIELDS (always shown) ========== */}
                    <div className="form-group">
                      <label className="form-label required">Full Name</label>
                      <input 
                        type="text" className="form-control"
                        placeholder="Enter alumnus full name"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        disabled={!isAdding && !isEditing}
                        required
                        autoFocus={isAdding}
                      />
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label required">Batch Year</label>
                        <select 
                          className="form-control"
                          value={profileForm.batch_year}
                          onChange={(e) => setProfileForm({ ...profileForm, batch_year: e.target.value })}
                          disabled={!isAdding && !isEditing}
                          required
                        >
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Stream</label>
                        <select 
                          className="form-control"
                          value={profileForm.stream}
                          onChange={(e) => setProfileForm({ ...profileForm, stream: e.target.value })}
                          disabled={!isAdding && !isEditing}
                        >
                          <option value="">— Select —</option>
                          <option value="PCMB">PCMB</option>
                          <option value="PCMCs">PCMCs</option>
                          <option value="Commerce">Commerce</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Contact Number</label>
                      <input 
                        type="text" className="form-control"
                        placeholder="9876543210"
                        value={profileForm.mobile}
                        onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
                        disabled={!isAdding && !isEditing}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Current Role / Work</label>
                      <input 
                        type="text" className="form-control"
                        placeholder="e.g. Software Engineer at Google, BSc at Christ University"
                        value={profileForm.current_institution_employer}
                        onChange={(e) => setProfileForm({ ...profileForm, current_institution_employer: e.target.value })}
                        disabled={!isAdding && !isEditing}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">URL (LinkedIn / Portfolio / Any)</label>
                      <input 
                        type="url" className="form-control"
                        placeholder="https://linkedin.com/in/username"
                        value={profileForm.linkedin_url}
                        onChange={(e) => setProfileForm({ ...profileForm, linkedin_url: e.target.value })}
                        disabled={!isAdding && !isEditing}
                      />
                    </div>

                    {/* ========== ADDITIONAL DETAILS (expandable in add mode, always shown in edit/view) ========== */}
                    {isAdding && (
                      <button 
                        type="button" 
                        onClick={() => setShowMoreFields(!showMoreFields)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'none', border: '1px dashed #cbd5e1', borderRadius: '4px',
                          padding: '8px 12px', cursor: 'pointer', fontSize: '11px',
                          color: '#475569', fontWeight: 500, width: '100%', justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {showMoreFields ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {showMoreFields ? 'Hide Additional Details' : 'Show Additional Details (DOB, Email, Roll No, Location...)'}
                      </button>
                    )}

                    {(!isAdding || showMoreFields) && (
                      <>
                        {isAdding && (
                          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '2px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                              Additional Details
                            </div>
                          </div>
                        )}

                        <div className="form-grid-2">
                          <div className="form-group">
                            <label className="form-label">Date of Birth</label>
                            <input 
                              type="date" className="form-control"
                              value={profileForm.dob}
                              onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                              disabled={!isAdding && !isEditing}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Gender</label>
                            <select 
                              className="form-control"
                              value={profileForm.gender}
                              onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                              disabled={!isAdding && !isEditing}
                            >
                              <option value="">— Select —</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Roll Number</label>
                          <input 
                            type="text" className="form-control"
                            placeholder="BGSXXXXXX"
                            value={profileForm.roll_number}
                            onChange={(e) => setProfileForm({ ...profileForm, roll_number: e.target.value })}
                            disabled={!isAdding && !isEditing}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Email</label>
                          <input 
                            type="email" className="form-control"
                            placeholder="alumni@email.com"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            disabled={!isAdding && !isEditing}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Secondary Contact</label>
                          <input 
                            type="text" className="form-control"
                            value={profileForm.secondary_contact}
                            onChange={(e) => setProfileForm({ ...profileForm, secondary_contact: e.target.value })}
                            disabled={!isAdding && !isEditing}
                          />
                        </div>

                        <div className="form-grid-3">
                          <div className="form-group">
                            <label className="form-label">City</label>
                            <input 
                              type="text" className="form-control"
                              value={profileForm.city}
                              onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                              disabled={!isAdding && !isEditing}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">State</label>
                            <input 
                              type="text" className="form-control"
                              value={profileForm.state}
                              onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                              disabled={!isAdding && !isEditing}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Country</label>
                            <input 
                              type="text" className="form-control"
                              value={profileForm.country}
                              onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                              disabled={!isAdding && !isEditing}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Degree Pursued after BGS</label>
                          <input 
                            type="text" className="form-control"
                            value={profileForm.degree_pursued}
                            onChange={(e) => setProfileForm({ ...profileForm, degree_pursued: e.target.value })}
                            disabled={!isAdding && !isEditing}
                          />
                        </div>

                        {(isAdding || isEditing) && (
                          <div className="form-group">
                            <label className="form-label">Profile Photo</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => setProfilePhoto(e.target.files[0])}
                                style={{ display: 'none' }}
                                id="profile-photo-upload"
                              />
                              <label htmlFor="profile-photo-upload" className="btn btn-xs btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', height: '24px' }}>
                                <Upload size={10} /> Choose Photo
                              </label>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>
                                {profilePhoto ? profilePhoto.name : 'No file chosen'}
                              </span>
                            </div>
                          </div>
                        )}

                        {!isAdding && selectedRow.photo_path && (
                          <div style={{ margin: '8px 0' }}>
                            <div className="form-label">Photo Profile</div>
                            <img 
                              src={selectedRow.photo_path} 
                              alt={selectedRow.name} 
                              style={{ width: '80px', height: '80px', objectFit: 'cover', border: '1px solid #cbd5e1', marginTop: '4px' }} 
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div className="form-group">
                      <label className="form-label">Internal notes</label>
                      <textarea 
                        className="form-control"
                        placeholder={isAdding ? 'Any notes about this alumnus...' : ''}
                        value={profileForm.notes}
                        onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                        disabled={!isAdding && !isEditing}
                      />
                    </div>

                    {!isAdding && selectedRow.updated_at && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0', fontFamily: 'monospace' }}>
                        Last modified by {selectedRow.updated_by} on {new Date(selectedRow.updated_at).toLocaleString()}
                      </div>
                    )}

                    {(isAdding || isEditing) && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button type="button" className="btn" onClick={() => isAdding ? setIsAdding(false) : setIsEditing(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                          {isAdding ? 'Add Alumni Record' : 'Save Profile'}
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {/* PROGRESS TIMELINE TAB */}
                {activeTab === 'milestones' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>LONGITUDINAL MILESTONES:</span>
                      {user.role !== 'Viewer' && !showMilestoneForm && (
                        <button type="button" className="btn btn-xs btn-primary" onClick={handleAddMilestoneClick}>
                          <Plus size={11} /> Add Milestone
                        </button>
                      )}
                    </div>

                    {showMilestoneForm && (
                      <form onSubmit={handleSaveMilestone} style={{ padding: '12px', border: '1px solid var(--accent-light)', backgroundColor: '#fdfdfd', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--accent-color)' }}>
                            {editingMilestoneId ? 'Edit Milestone' : 'New Milestone Log'}
                          </span>
                          <button type="button" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setShowMilestoneForm(false)}>
                            <X size={12} />
                          </button>
                        </div>

                        <div className="form-group">
                          <label className="form-label required">Type</label>
                          <select 
                            className="form-control"
                            value={milestoneType}
                            onChange={(e) => setMilestoneType(e.target.value)}
                          >
                            <option value="Education">Education</option>
                            <option value="Professional">Professional</option>
                            <option value="Competitive Exam">Competitive Exam</option>
                            <option value="Achievement">Achievement</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label required">
                            {milestoneType === 'Education' && 'Degree / Course Pursued'}
                            {milestoneType === 'Professional' && 'Company / Employer Name'}
                            {milestoneType === 'Competitive Exam' && 'Exam Name (e.g. NEET, JEE)'}
                            {milestoneType === 'Achievement' && 'Award / Recognition Name'}
                          </label>
                          <input 
                            type="text" className="form-control"
                            value={milestoneField1}
                            onChange={(e) => setMilestoneField1(e.target.value)}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            {milestoneType === 'Education' && 'College / University / Institution'}
                            {milestoneType === 'Professional' && 'Job Designation / Role'}
                            {milestoneType === 'Competitive Exam' && 'Score / Grade Description'}
                            {milestoneType === 'Achievement' && 'Recognizing Body / Details'}
                          </label>
                          <input 
                            type="text" className="form-control"
                            value={milestoneField2}
                            onChange={(e) => setMilestoneField2(e.target.value)}
                          />
                        </div>

                        <div className="form-grid-2">
                          <div className="form-group">
                            <label className="form-label">
                              {milestoneType === 'Education' && 'Year of Graduation'}
                              {milestoneType === 'Professional' && 'Joining Year'}
                              {milestoneType === 'Competitive Exam' && 'Year Taken'}
                              {milestoneType === 'Achievement' && 'Date Awarded'}
                            </label>
                            <input 
                              type="text" className="form-control"
                              value={milestoneField3}
                              onChange={(e) => setMilestoneField3(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              {milestoneType === 'Education' && 'Percentage / Grade / CGPA'}
                              {milestoneType === 'Professional' && 'Status (e.g., Current, Former)'}
                              {milestoneType === 'Competitive Exam' && 'Outcome (e.g., Qualified)'}
                              {milestoneType === 'Achievement' && 'Internal Remarks'}
                            </label>
                            <input 
                              type="text" className="form-control"
                              value={milestoneField4}
                              onChange={(e) => setMilestoneField4(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Document Attachment (Marksheet/Certificate/Offer Letter)</label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="file" 
                              accept=".pdf,image/*,.docx"
                              onChange={(e) => setMilestoneFile(e.target.files[0])}
                              style={{ display: 'none' }}
                              id="milestone-file-upload"
                            />
                            <label htmlFor="milestone-file-upload" className="btn btn-xs btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', height: '24px' }}>
                              <Upload size={10} /> Choose Attachment
                            </label>
                            <span style={{ fontSize: '10px', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {milestoneFile ? milestoneFile.name : 'No attachment file'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button type="button" className="btn btn-xs" onClick={() => setShowMilestoneForm(false)}>Cancel</button>
                          <button type="submit" className="btn btn-xs btn-primary" style={{ flexGrow: 1 }}>Save Milestone</button>
                        </div>
                      </form>
                    )}

                    {loadingMilestones ? (
                      <p style={{ fontFamily: 'monospace', fontSize: '11px' }}>Loading timeline...</p>
                    ) : milestones.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', padding: '20px' }}>No academic or professional timeline events logged.</p>
                    ) : (
                      <div className="timeline">
                        {milestones.map(m => (
                          <div key={m.id} className={`timeline-item ${m.type}`}>
                            <div className="timeline-marker"></div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-title">
                                  [{m.type.toUpperCase()}] {m.field1}
                                </span>
                                <span className="timeline-date">{m.field3}</span>
                              </div>
                              <div className="timeline-body">
                                {m.type === 'Education' && `${m.field2} ${m.field4 ? `| Grade: ${m.field4}` : ''}`}
                                {m.type === 'Professional' && `${m.field2} (${m.field4 || 'Former'})`}
                                {m.type === 'Competitive Exam' && `Exam Authority: ${m.field2} | Outcomes: ${m.field4 || 'Awaiting'}`}
                                {m.type === 'Achievement' && `${m.field2 || ''} ${m.field4 ? `| Remarks: ${m.field4}` : ''}`}
                              </div>

                              {m.attachment_path && (
                                <a 
                                  href={m.attachment_path} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="timeline-attachment"
                                >
                                  <ExternalLink size={10} /> View Document Certificate
                                </a>
                              )}

                              {user.role !== 'Viewer' && (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                                  <button type="button" className="btn btn-xs" style={{ padding: '1px 4px', fontSize: '10px' }} onClick={() => handleEditMilestoneClick(m)}>Edit</button>
                                  <button type="button" className="btn btn-xs btn-danger" style={{ padding: '1px 4px', fontSize: '10px' }} onClick={() => handleDeleteMilestone(m.id)}>Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* INTERACTIONS HISTORIC TAB */}
                {activeTab === 'interactions' && (
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569', display: 'block', marginBottom: '8px' }}>
                      INTERACTIONS LOGGER:
                    </span>
                    {loadingInteractions ? (
                      <p style={{ fontFamily: 'monospace', fontSize: '11px' }}>Retrieving history...</p>
                    ) : interactions.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', padding: '20px' }}>No interaction logs recorded.</p>
                    ) : (
                      <div className="timeline" style={{ paddingLeft: '14px' }}>
                        {interactions.map((it, idx) => (
                          <div key={idx} className="timeline-item" style={{ marginBottom: '12px' }}>
                            <div className="timeline-marker" style={{ backgroundColor: it.category === 'meeting' ? '#059669' : '#d97706' }}></div>
                            <div className="timeline-content" style={{ padding: '6px 10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                <span style={{ color: it.category === 'meeting' ? '#059669' : '#d97706' }}>
                                  {it.category === 'meeting' ? 'MEETING' : `SENT ${it.type.toUpperCase()}`}
                                </span>
                                <span style={{ color: '#64748b' }}>{new Date(it.datetime).toLocaleString().slice(0, 17)}</span>
                              </div>
                              <div style={{ fontWeight: 500, fontSize: '11.5px', marginTop: '2px' }}>
                                {it.category === 'meeting' ? it.title : it.subject}
                              </div>
                              <p style={{ fontSize: '11px', color: '#475569', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                {it.category === 'meeting' ? it.notes : it.message}
                              </p>
                              {it.category === 'meeting' && it.outcome && (
                                <div style={{ fontSize: '11px', color: '#047857', borderTop: '1px dashed #cbd5e1', marginTop: '6px', paddingTop: '4px' }}>
                                  <strong>Outcome note:</strong> {it.outcome}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky status bar at bottom of the main-workspace */}
      <footer className="status-bar">
        <div className="status-bar-left">
          <span>ALUMNI COUNT: {alumni.length} matching filter</span>
          {selectedAlumniIds.length > 0 && (
            <span style={{ color: '#93c5fd', fontWeight: 600 }}>[ {selectedAlumniIds.length} profiles selected ]</span>
          )}
        </div>
        
        <div className="status-bar-right">
          {selectedAlumniIds.length > 0 && (
            <button 
              className="btn btn-primary btn-xs" 
              onClick={() => setShowExportModal(true)}
              style={{ height: '22px', fontSize: '11px' }}
            >
              <FileDown size={11} />
              Export Selected PDF ({selectedAlumniIds.length})
            </button>
          )}
          <span>Role: {user.role}</span>
        </div>
      </footer>

      {/* PDF Export Configuration Modal */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">PDF Report Configuration Options</div>
              <button className="btn btn-xs" style={{ border: 'none' }} onClick={() => setShowExportModal(false)}>
                <X size={14} />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Report Template</label>
                <select 
                  className="form-control" 
                  value={pdfTemplate} 
                  onChange={(e) => setPdfTemplate(e.target.value)}
                >
                  <option value="full">Full Profile (All fields, timeline, interactions)</option>
                  <option value="summary">Summary Directory Profile (Name, batch, stream, current, contact)</option>
                  <option value="milestones">Progress Timeline Report Only</option>
                  <option value="custom">Custom (Select sections below)</option>
                </select>
              </div>

              {pdfTemplate === 'custom' && (
                <div style={{ border: '1px solid #e2e8f0', padding: '8px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={pdfSections.personal} onChange={(e) => setPdfSections({ ...pdfSections, personal: e.target.checked })} /> Personal info
                  </label>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={pdfSections.contact} onChange={(e) => setPdfSections({ ...pdfSections, contact: e.target.checked })} /> Contacts
                  </label>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={pdfSections.milestones} onChange={(e) => setPdfSections({ ...pdfSections, milestones: e.target.checked })} /> Progress Milestones
                  </label>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={pdfSections.interactions} onChange={(e) => setPdfSections({ ...pdfSections, interactions: e.target.checked })} /> Interactions Logs
                  </label>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Layout Mode</label>
                  <select 
                    className="form-control" 
                    value={pdfLayout} 
                    onChange={(e) => setPdfLayout(e.target.value)}
                  >
                    <option value="page-per-record">New Page Per Alumnus</option>
                    <option value="condensed">Condensed Stack (Multiple per page)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Watermark</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '28px', fontSize: '11px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={pdfConfidential} 
                      onChange={(e) => setPdfConfidential(e.target.checked)} 
                    />
                    CONFIDENTIAL Watermark
                  </label>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                  <strong>Institutional Export Standards:</strong> Each document includes the official BGS PU College letterhead at the top. The footer logs your staff ID, signature, generation timestamp, and automated sequential page numbers.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExportPDF} disabled={exporting}>
                {exporting ? 'Generating PDF...' : 'Download PDF Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Templated Email Modal */}
      {showBulkEmailModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="modal-title">Send Templated Emails to Recipients</div>
              <button className="btn btn-xs" style={{ border: 'none' }} onClick={() => setShowBulkEmailModal(false)}>
                <X size={14} />
              </button>
            </div>
            
            <div className="modal-body">
              <p style={{ fontSize: '11.5px', marginBottom: '12px' }}>
                You are dispatching templated emails to <strong>{selectedAlumniIds.length}</strong> selected alumni.
              </p>

              <div className="form-group">
                <label className="form-label">Choose Email Template</label>
                <select 
                  className="form-control" 
                  value={selectedTemplateId} 
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedTemplateId && (
                <div style={{ border: '1px solid #e2e8f0', padding: '10px', backgroundColor: '#f8fafc', marginTop: '10px' }}>
                  <div style={{ fontWeight: 600, fontSize: '11px' }}>Subject Preview:</div>
                  <div style={{ fontSize: '11.5px', color: '#334155', marginBottom: '8px' }}>
                    {templates.find(x => x.id === parseInt(selectedTemplateId))?.subject}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '11px' }}>Message Preview:</div>
                  <div style={{ fontSize: '11px', color: '#475569', maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {templates.find(x => x.id === parseInt(selectedTemplateId))?.body}
                  </div>
                </div>
              )}

              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '12px' }}>
                Note: Standard variables like <code>{`{{name}}`}</code> and <code>{`{{batch}}`}</code> will be auto-replaced before dispatch. The outbound logs are written in the communications tab.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowBulkEmailModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendBulkEmail} disabled={sendingEmail}>
                {sendingEmail ? 'Sending...' : 'Confirm & Send Emails'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
