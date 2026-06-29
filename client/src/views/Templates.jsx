import React, { useState, useEffect } from 'react';
import { FileEdit, Save, ShieldAlert, Plus, Trash2, X } from 'lucide-react';

export default function Templates({ user, triggerToast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Editor/Create form state
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (selectId = null) => {
    setLoading(true);
    try {
      const res = await fetch('/api/communications/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0) {
          const toSelect = selectId ? data.find(t => t.id === selectId) : null;
          selectTemplate(toSelect || data[0]);
        } else {
          setSelectedTemplate(null);
          setSubject('');
          setBody('');
        }
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error loading communication templates.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (temp) => {
    setIsAdding(false);
    setSelectedTemplate(temp);
    setSubject(temp.subject);
    setBody(temp.body);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (isAdding && !name.trim()) {
      triggerToast('Template name cannot be empty.', 'error');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      triggerToast('Subject and email body contents cannot be left blank.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const url = isAdding ? '/api/communications/templates' : `/api/communications/templates/${selectedTemplate.id}`;
      const method = isAdding ? 'POST' : 'PUT';
      const bodyData = isAdding ? { name: name.trim(), subject: subject.trim(), body: body.trim() } : { subject: subject.trim(), body: body.trim() };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        const data = await res.json();
        triggerToast(isAdding ? `Template '${name}' created successfully.` : `Template '${selectedTemplate.name}' updated successfully.`);
        setIsAdding(false);
        setName('');
        if (isAdding && data.id) {
          fetchTemplates(data.id);
        } else {
          fetchTemplates(selectedTemplate?.id);
        }
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to save template.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error during template save.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (!window.confirm(`Are you sure you want to permanently delete the template '${selectedTemplate.name}'?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/communications/templates/${selectedTemplate.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        triggerToast(`Template '${selectedTemplate.name}' deleted successfully.`);
        fetchTemplates();
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to delete template.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error during template deletion.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <FileEdit size={16} />
          Email Communications Templates Editor
        </div>
      </header>

      <div className="workspace-content" style={{ display: 'flex', flexDirection: 'row', gap: '16px', padding: '12px 16px', overflow: 'hidden' }}>
        
        {/* Left Side: Template selector list */}
        <div style={{ width: '220px', border: '1px solid #cbd5e1', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="pane-header" style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="pane-title" style={{ fontSize: '11px' }}>AVAILABLE TEMPLATES</div>
            {user.role !== 'Viewer' && (
              <button 
                type="button" 
                className="btn btn-xs btn-primary"
                onClick={() => {
                  setIsAdding(true);
                  setName('');
                  setSubject('');
                  setBody('');
                  setSelectedTemplate(null);
                }}
                style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px' }}
              >
                <Plus size={10} /> Add
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flexGrow: 1 }}>
            {loading ? (
              <p style={{ padding: '12px', fontFamily: 'monospace', fontSize: '11px' }}>Loading templates...</p>
            ) : templates.length === 0 ? (
              <p style={{ padding: '12px', color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>No templates available.</p>
            ) : (
              templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t)}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    background: selectedTemplate?.id === t.id ? 'var(--accent-light)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    color: selectedTemplate?.id === t.id ? 'var(--accent-color)' : 'var(--text-primary)',
                    fontWeight: selectedTemplate?.id === t.id ? 600 : 400,
                    fontSize: '11.5px'
                  }}
                >
                  {t.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Template Editor Form */}
        <div style={{ flexGrow: 1, backgroundColor: '#fff', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column' }}>
          <div className="pane-header" style={{ borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="pane-title">
              {isAdding ? 'Create New Template' : selectedTemplate ? `Edit Template: ${selectedTemplate.name}` : 'No Template Selected'}
            </div>
            {isAdding && (
              <button 
                type="button" 
                className="btn btn-xs" 
                onClick={() => {
                  setIsAdding(false);
                  if (templates.length > 0) {
                    selectTemplate(templates[0]);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <X size={12} /> Cancel
              </button>
            )}
          </div>

          <div className="pane-content" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {(selectedTemplate || isAdding) ? (
              <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                
                {user.role === 'Viewer' && (
                  <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', fontSize: '11px' }}>
                    <ShieldAlert size={14} />
                    Viewer role restriction: Read-only access to email templates.
                  </div>
                )}

                {isAdding && (
                  <div className="form-group">
                    <label className="form-label required">Template Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Welcome onboard"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required">Email Subject Line</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter subject line..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={user.role === 'Viewer' || submitting}
                    required
                  />
                </div>

                <div className="form-group" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label required">Email Body Content</label>
                  <textarea
                    className="form-control"
                    placeholder="Enter template body..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={user.role === 'Viewer' || submitting}
                    style={{ flexGrow: 1, height: '260px', fontFamily: 'monospace', fontSize: '11.5px', lineHeight: '1.4' }}
                    required
                  />
                </div>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', lineHeight: '1.4' }}>
                    <strong>Supported Variables:</strong><br />
                    Use <code>{`{{name}}`}</code> to dynamically insert the recipient's full name, and <code>{`{{batch}}`}</code> to insert the alumnus batch graduation year.
                  </div>

                  {user.role !== 'Viewer' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Save size={12} />
                        {submitting ? 'Saving...' : isAdding ? 'Create Template' : 'Save Template'}
                      </button>
                      {!isAdding && selectedTemplate && (
                        <button type="button" className="btn btn-danger" onClick={handleDeleteTemplate} disabled={submitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <Trash2 size={12} />
                          Delete Template
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>Please choose a template from the sidebar or click add to create one.</p>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
