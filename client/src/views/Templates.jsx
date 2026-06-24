import React, { useState, useEffect } from 'react';
import { FileEdit, Save, ShieldAlert } from 'lucide-react';

export default function Templates({ user, triggerToast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // Editor form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/communications/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0) {
          selectTemplate(data[0]);
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
    setSelectedTemplate(temp);
    setSubject(temp.subject);
    setBody(temp.body);
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      triggerToast('Subject and email body contents cannot be left blank.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/communications/templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body })
      });

      if (res.ok) {
        triggerToast(`Template '${selectedTemplate.name}' updated successfully.`);
        fetchTemplates();
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to update template.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error during template update.', 'error');
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
          <div className="pane-header" style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>
            <div className="pane-title" style={{ fontSize: '11px' }}>AVAILABLE TEMPLATES</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flexGrow: 1 }}>
            {loading ? (
              <p style={{ padding: '12px', fontFamily: 'monospace', fontSize: '11px' }}>Loading templates...</p>
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
          <div className="pane-header" style={{ borderBottom: '1px solid #cbd5e1' }}>
            <div className="pane-title">
              {selectedTemplate ? `Edit Template: ${selectedTemplate.name}` : 'No Template Selected'}
            </div>
          </div>

          <div className="pane-content" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {selectedTemplate ? (
              <form onSubmit={handleUpdateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                
                {user.role === 'Viewer' && (
                  <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', fontSize: '11px' }}>
                    <ShieldAlert size={14} />
                    Viewer role restriction: Read-only access to email templates.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required">Email Subject Line</label>
                  <input
                    type="text"
                    className="form-control"
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
                    <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '120px' }}>
                      <Save size={12} />
                      {submitting ? 'Saving...' : 'Save Template'}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px' }}>Please choose a template from the sidebar.</p>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
