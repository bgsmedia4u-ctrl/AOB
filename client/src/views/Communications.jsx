import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Filter, Plus, X, Eye, PhoneCall, Mail,
  MessageCircle, MapPin, Send, Search, CheckCircle2, AlertCircle
} from 'lucide-react';

// WhatsApp SVG icon (Lucide doesn't have one)
const WhatsAppIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Gmail SVG icon
const GmailIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.910 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
  </svg>
);

export default function Communications({ user, triggerToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alumniList, setAlumniList] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Filters state
  const [filterType, setFilterType] = useState('');
  const [filterResponse, setFilterResponse] = useState('');
  const [filterStaff, setFilterStaff] = useState('');

  // Modal visibility
  const [showLogModal, setShowLogModal] = useState(false);
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Sending/loading state
  const [sending, setSending] = useState(false);

  // WhatsApp result (list of wa.me links to open)
  const [waResult, setWaResult] = useState(null); // { recipients: [{name, mobile}], message }

  // --- Manual log form ---
  const [logForm, setLogForm] = useState({
    type: 'phone call', datetime: '', subject: '', message: '',
    response_received: 'no', response_summary: '', alumni_ids: []
  });

  // --- Gmail compose form ---
  const [gmailForm, setGmailForm] = useState({
    subject: '', body: '', alumni_ids: [], templateId: ''
  });
  const [gmailSearch, setGmailSearch] = useState('');
  const [gmailAlumni, setGmailAlumni] = useState([]);

  // --- WhatsApp form ---
  const [waForm, setWaForm] = useState({ message: '', alumni_ids: [] });
  const [waSearch, setWaSearch] = useState('');
  const [waAlumni, setWaAlumni] = useState([]);

  useEffect(() => {
    fetchLogs();
    fetchAllAlumni();
    fetchTemplates();
  }, [filterType, filterResponse, filterStaff]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterResponse) params.append('response_received', filterResponse);
      if (filterStaff) params.append('staff_initiator', filterStaff);
      const res = await fetch(`/api/communications/logs?${params.toString()}`);
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error(err);
      triggerToast('Error loading communication archives.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAlumni = async (search = '') => {
    try {
      const params = new URLSearchParams({ limit: '5000' });
      if (search) params.append('search', search);
      const res = await fetch(`/api/alumni?${params.toString()}`);
      if (res.ok) setAlumniList(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/communications/templates');
      if (res.ok) setTemplates(await res.json());
    } catch (err) { console.error(err); }
  };

  const searchAlumniFor = async (type, term) => {
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (term) params.append('search', term);
      const res = await fetch(`/api/alumni?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (type === 'gmail') setGmailAlumni(data);
        if (type === 'wa') setWaAlumni(data);
      }
    } catch (err) { console.error(err); }
  };

  // --- MODAL OPENERS ---
  const openLogModal = () => {
    setLogForm({
      type: 'phone call', datetime: new Date().toISOString().slice(0, 16),
      subject: '', message: '', response_received: 'no', response_summary: '', alumni_ids: []
    });
    setShowLogModal(true);
  };

  const openGmailModal = () => {
    setGmailForm({ subject: '', body: '', alumni_ids: [], templateId: '' });
    setGmailSearch('');
    searchAlumniFor('gmail', '');
    setShowGmailModal(true);
  };

  const openWhatsAppModal = () => {
    setWaForm({ message: '', alumni_ids: [] });
    setWaSearch('');
    setWaResult(null);
    searchAlumniFor('wa', '');
    setShowWhatsAppModal(true);
  };

  // --- Template pick for Gmail modal ---
  const handleTemplateSelect = (templateId) => {
    setGmailForm(prev => ({ ...prev, templateId }));
    if (!templateId) return;
    const t = templates.find(x => x.id === parseInt(templateId));
    if (t) setGmailForm(prev => ({ ...prev, subject: t.subject, body: t.body, templateId }));
  };

  // --- SUBMIT HANDLERS ---
  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!logForm.subject || !logForm.message) {
      triggerToast('Subject and message are required.', 'error'); return;
    }
    try {
      const res = await fetch('/api/communications/logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logForm)
      });
      if (res.ok) {
        triggerToast('Communication logged successfully.');
        setShowLogModal(false); fetchLogs();
      } else {
        const d = await res.json();
        triggerToast(d.error || 'Failed to log.', 'error');
      }
    } catch (err) {
      triggerToast('Network error.', 'error');
    }
  };

  const handleSendGmail = async (e) => {
    e.preventDefault();
    if (!gmailForm.subject.trim() || !gmailForm.body.trim()) {
      triggerToast('Subject and body are required.', 'error'); return;
    }
    if (gmailForm.alumni_ids.length === 0) {
      triggerToast('Select at least one recipient.', 'error'); return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/communications/send-custom-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: gmailForm.subject,
          body: gmailForm.body,
          alumni_ids: gmailForm.alumni_ids
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(data.message);
        setShowGmailModal(false); fetchLogs();
      } else {
        triggerToast(data.error || 'Email send failed.', 'error');
      }
    } catch (err) {
      triggerToast('Network error sending email.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async (e) => {
    e.preventDefault();
    if (!waForm.message.trim()) {
      triggerToast('Message is required.', 'error'); return;
    }
    if (waForm.alumni_ids.length === 0) {
      triggerToast('Select at least one recipient.', 'error'); return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/communications/log-whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: waForm.message, alumni_ids: waForm.alumni_ids })
      });
      const data = await res.json();
      if (res.ok) {
        // Show the wa.me links to open
        setWaResult({ recipients: data.recipients, message: waForm.message });
        fetchLogs();
      } else {
        triggerToast(data.error || 'Failed to log WhatsApp.', 'error');
      }
    } catch (err) {
      triggerToast('Network error.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Build wa.me URL for a mobile number (Indian +91 prefix if no country code)
  const buildWaLink = (mobile, message) => {
    if (!mobile) return null;
    const clean = mobile.replace(/\D/g, '');
    const num = clean.startsWith('91') && clean.length === 12 ? clean : `91${clean}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  };

  const handleAlumniCheckbox = (type, id) => {
    const setter = type === 'gmail' ? setGmailForm : setWaForm;
    setter(prev => {
      const ids = prev.alumni_ids.includes(id)
        ? prev.alumni_ids.filter(x => x !== id)
        : [...prev.alumni_ids, id];
      return { ...prev, alumni_ids: ids };
    });
  };

  const handleAlumniMultiSelect = (e) => {
    const options = e.target.options;
    const selectedIds = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) selectedIds.push(parseInt(options[i].value));
    }
    setLogForm({ ...logForm, alumni_ids: selectedIds });
  };

  const typeIcon = (type) => {
    if (type === 'email') return <Mail size={11} />;
    if (type === 'WhatsApp') return <WhatsAppIcon size={11} />;
    if (type === 'phone call') return <PhoneCall size={11} />;
    if (type === 'in-person') return <MapPin size={11} />;
    return <MessageSquare size={11} />;
  };

  const typeColor = (type) => {
    if (type === 'email') return '#dc2626';
    if (type === 'WhatsApp') return '#25d366';
    if (type === 'phone call') return '#2563eb';
    if (type === 'SMS') return '#7c3aed';
    return '#64748b';
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <MessageSquare size={16} />
          Outbound Communications Log
        </div>
        {user.role !== 'Viewer' && (
          <div className="workspace-actions">
            {/* Gmail Compose Button */}
            <button
              id="btn-compose-gmail"
              className="btn"
              onClick={openGmailModal}
              style={{
                background: 'linear-gradient(135deg, #ea4335 0%, #fbbc04 33%, #34a853 66%, #4285f4 100%)',
                color: '#fff', border: 'none', fontWeight: 600, gap: '6px'
              }}
            >
              <GmailIcon size={13} />
              Send Gmail
            </button>

            {/* WhatsApp Button */}
            <button
              id="btn-compose-whatsapp"
              className="btn"
              onClick={openWhatsAppModal}
              style={{
                backgroundColor: '#25d366', color: '#fff',
                border: 'none', fontWeight: 600, gap: '6px'
              }}
            >
              <WhatsAppIcon size={13} />
              Send WhatsApp
            </button>

            <button className="btn" onClick={openLogModal}>
              <Plus size={13} />
              Log Manual Interaction
            </button>
          </div>
        )}
      </header>

      <div className="workspace-content">
        {/* Filters */}
        <div className="control-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} style={{ color: '#64748b' }} />
            <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>FILTERS:</span>
          </div>
          <select className="form-control filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="email">Email</option>
            <option value="SMS">SMS</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="phone call">Phone Call</option>
            <option value="in-person">In-Person</option>
          </select>
          <select className="form-control filter-select" value={filterResponse} onChange={e => setFilterResponse(e.target.value)}>
            <option value="">All Responses</option>
            <option value="yes">Response Received</option>
            <option value="no">No Response</option>
            <option value="pending">Pending</option>
          </select>
          <input
            type="text" className="form-control" placeholder="Staff initiator..."
            value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
            style={{ width: '130px' }}
          />
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace' }}>RETRIEVING DISPATCH ARCHIVES...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No communication logs archived.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Channel</th>
                  <th>Subject</th>
                  <th>Sender Staff</th>
                  <th>Recipients</th>
                  <th>Response</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {new Date(log.datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).slice(0, 17)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        color: typeColor(log.type), fontWeight: 600, fontSize: '11px',
                        textTransform: 'capitalize'
                      }}>
                        {typeIcon(log.type)} {log.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.subject}</td>
                    <td>{log.staff_initiator}</td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.recipients?.length > 0 ? log.recipients.map(r => r.name).join(', ') : 'None'}
                    </td>
                    <td>
                      <span className={`badge badge-${log.response_received === 'yes' ? 'active' : log.response_received === 'pending' ? 'warning' : 'archived'}`}>
                        {log.response_received}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-xs" onClick={() => setSelectedLog(log)}>
                        <Eye size={11} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ===== GMAIL COMPOSE MODAL ===== */}
      {showGmailModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSendGmail} style={{ maxWidth: '580px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #ea4335, #fbbc04, #34a853, #4285f4)',
              color: '#fff'
            }}>
              <div className="modal-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GmailIcon size={15} /> Compose & Send Gmail
              </div>
              <button type="button" className="btn btn-xs" style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => setShowGmailModal(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Template Picker */}
              {templates.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Load from Template (optional)</label>
                  <select
                    className="form-control"
                    value={gmailForm.templateId}
                    onChange={e => handleTemplateSelect(e.target.value)}
                  >
                    <option value="">— Write custom email —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div className="form-group">
                <label className="form-label required">Email Subject</label>
                <input
                  type="text" className="form-control" required
                  placeholder="e.g. Annual Alumni Meet 2026 Invitation"
                  value={gmailForm.subject}
                  onChange={e => setGmailForm(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>

              {/* Body */}
              <div className="form-group">
                <label className="form-label required">Email Body</label>
                <textarea
                  className="form-control" required rows={6}
                  style={{ height: '140px', fontFamily: 'monospace', fontSize: '12px' }}
                  placeholder={"Dear {{name}},\n\nYour message here...\n\nBest regards,\nBGS PU College Admin"}
                  value={gmailForm.body}
                  onChange={e => setGmailForm(prev => ({ ...prev, body: e.target.value }))}
                />
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  Use <code>{'{{name}}'}</code> and <code>{'{{batch}}'}</code> as personalization placeholders.
                </span>
              </div>

              {/* Recipient Search + Checklist */}
              <div className="form-group">
                <label className="form-label required">Recipients</label>
                <div style={{ position: 'relative', marginBottom: '6px' }}>
                  <input
                    type="text" className="form-control"
                    placeholder="Search alumni by name, batch, stream..."
                    value={gmailSearch}
                    onChange={e => { setGmailSearch(e.target.value); searchAlumniFor('gmail', e.target.value); }}
                    style={{ paddingLeft: '28px' }}
                  />
                  <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                </div>

                <div style={{
                  border: '1px solid #cbd5e1', maxHeight: '160px', overflowY: 'auto',
                  background: '#f8fafc'
                }}>
                  {gmailAlumni.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                      No alumni found. Type to search.
                    </div>
                  ) : (
                    gmailAlumni.map(a => (
                      <label key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 10px', cursor: 'pointer', fontSize: '11.5px',
                        borderBottom: '1px solid #e2e8f0',
                        background: gmailForm.alumni_ids.includes(a.id) ? '#eff6ff' : 'transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={gmailForm.alumni_ids.includes(a.id)}
                          onChange={() => handleAlumniCheckbox('gmail', a.id)}
                        />
                        <span style={{ fontWeight: 600 }}>{a.name}</span>
                        <span style={{ color: '#64748b' }}>Batch {a.batch_year} · {a.stream}</span>
                        {a.email ? (
                          <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: '10px' }}>{a.email}</span>
                        ) : (
                          <span style={{ color: '#f59e0b', marginLeft: 'auto', fontSize: '10px' }}>⚠ No email</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  {gmailForm.alumni_ids.length} recipient(s) selected
                  {gmailForm.alumni_ids.length > 0 && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px', marginLeft: '8px' }}
                      onClick={() => setGmailForm(prev => ({ ...prev, alumni_ids: [] }))}
                    >
                      Clear all
                    </button>
                  )}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setShowGmailModal(false)} disabled={sending}>Cancel</button>
              <button
                type="submit"
                className="btn"
                disabled={sending}
                style={{
                  background: 'linear-gradient(135deg, #ea4335, #4285f4)',
                  color: '#fff', border: 'none', fontWeight: 600
                }}
              >
                <Send size={12} />
                {sending ? 'Sending...' : `Send to ${gmailForm.alumni_ids.length} Recipient(s)`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== WHATSAPP MODAL ===== */}
      {showWhatsAppModal && (
        <div className="modal-overlay">
          <div style={{ width: '100%', maxWidth: '560px' }}>
            {!waResult ? (
              <form className="modal-content" onSubmit={handleSendWhatsApp} style={{ maxWidth: '560px' }}>
                <div className="modal-header" style={{ backgroundColor: '#25d366' }}>
                  <div className="modal-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <WhatsAppIcon size={15} /> Send WhatsApp Message
                  </div>
                  <button type="button" className="btn btn-xs" style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => setShowWhatsAppModal(false)}>
                    <X size={14} />
                  </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '2px',
                    padding: '8px 12px', fontSize: '11px', color: '#15803d'
                  }}>
                    💡 After confirming, WhatsApp Web links will open for each selected recipient. Messages are automatically logged.
                  </div>

                  {/* Message */}
                  <div className="form-group">
                    <label className="form-label required">Message to Send</label>
                    <textarea
                      className="form-control" required rows={5}
                      style={{ height: '120px', fontSize: '12px' }}
                      placeholder="Type your WhatsApp message here..."
                      value={waForm.message}
                      onChange={e => setWaForm(prev => ({ ...prev, message: e.target.value }))}
                    />
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      Characters: {waForm.message.length}
                    </span>
                  </div>

                  {/* Recipient Search + Checklist */}
                  <div className="form-group">
                    <label className="form-label required">Recipients</label>
                    <div style={{ position: 'relative', marginBottom: '6px' }}>
                      <input
                        type="text" className="form-control"
                        placeholder="Search alumni by name, batch, stream..."
                        value={waSearch}
                        onChange={e => { setWaSearch(e.target.value); searchAlumniFor('wa', e.target.value); }}
                        style={{ paddingLeft: '28px' }}
                      />
                      <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                    </div>

                    <div style={{
                      border: '1px solid #cbd5e1', maxHeight: '160px', overflowY: 'auto',
                      background: '#f8fafc'
                    }}>
                      {waAlumni.length === 0 ? (
                        <div style={{ padding: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                          No alumni found. Type to search.
                        </div>
                      ) : (
                        waAlumni.map(a => (
                          <label key={a.id} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 10px', cursor: 'pointer', fontSize: '11.5px',
                            borderBottom: '1px solid #e2e8f0',
                            background: waForm.alumni_ids.includes(a.id) ? '#f0fdf4' : 'transparent'
                          }}>
                            <input
                              type="checkbox"
                              checked={waForm.alumni_ids.includes(a.id)}
                              onChange={() => handleAlumniCheckbox('wa', a.id)}
                            />
                            <span style={{ fontWeight: 600 }}>{a.name}</span>
                            <span style={{ color: '#64748b' }}>Batch {a.batch_year} · {a.stream}</span>
                            {a.mobile ? (
                              <span style={{ color: '#25d366', marginLeft: 'auto', fontSize: '10px', fontWeight: 600 }}>
                                📱 {a.mobile}
                              </span>
                            ) : (
                              <span style={{ color: '#f59e0b', marginLeft: 'auto', fontSize: '10px' }}>⚠ No mobile</span>
                            )}
                          </label>
                        ))
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      {waForm.alumni_ids.length} recipient(s) selected
                      {waForm.alumni_ids.length > 0 && (
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px', marginLeft: '8px' }}
                          onClick={() => setWaForm(prev => ({ ...prev, alumni_ids: [] }))}
                        >
                          Clear all
                        </button>
                      )}
                    </span>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn" onClick={() => setShowWhatsAppModal(false)} disabled={sending}>Cancel</button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={sending}
                    style={{ backgroundColor: '#25d366', color: '#fff', border: 'none', fontWeight: 600 }}
                  >
                    <WhatsAppIcon size={12} />
                    {sending ? 'Logging...' : `Proceed — ${waForm.alumni_ids.length} recipient(s)`}
                  </button>
                </div>
              </form>
            ) : (
              /* WA Result — show clickable wa.me links */
              <div className="modal-content" style={{ maxWidth: '560px' }}>
                <div className="modal-header" style={{ backgroundColor: '#25d366' }}>
                  <div className="modal-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={15} /> WhatsApp Links Ready — Click to Open
                  </div>
                </div>
                <div className="modal-body">
                  <p style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                    The outreach has been logged. Click each link below to open WhatsApp Web and send the pre-filled message:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {waResult.recipients.map(r => {
                      const link = buildWaLink(r.mobile, waResult.message);
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 12px', border: '1px solid #86efac',
                          background: '#f0fdf4', justifyContent: 'space-between'
                        }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>{r.name}</span>
                            <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '8px' }}>
                              {r.mobile || '(no mobile number)'}
                            </span>
                          </div>
                          {link ? (
                            <a
                              href={link} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                backgroundColor: '#25d366', color: '#fff',
                                padding: '4px 10px', textDecoration: 'none',
                                fontSize: '11px', fontWeight: 600
                              }}
                            >
                              <WhatsAppIcon size={11} /> Open Chat
                            </a>
                          ) : (
                            <span style={{ color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={11} /> No mobile number on record
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => { setShowWhatsAppModal(false); setWaResult(null); }}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MANUAL LOG MODAL ===== */}
      {showLogModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSaveLog} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">Log Offline Interaction</div>
              <button type="button" className="btn btn-xs" style={{ border: 'none' }} onClick={() => setShowLogModal(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label required">Type / Channel</label>
                  <select className="form-control" value={logForm.type} onChange={e => setLogForm({ ...logForm, type: e.target.value })}>
                    <option value="phone call">Phone Call</option>
                    <option value="in-person">In-Person</option>
                    <option value="SMS">SMS</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Date & Time</label>
                  <input type="datetime-local" className="form-control" value={logForm.datetime} onChange={e => setLogForm({ ...logForm, datetime: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label required">Subject / Purpose</label>
                <input type="text" className="form-control" placeholder="e.g. general info validation check" value={logForm.subject} onChange={e => setLogForm({ ...logForm, subject: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Link Recipient(s)</label>
                <select multiple className="form-control" value={logForm.alumni_ids} onChange={handleAlumniMultiSelect} style={{ height: '80px' }}>
                  {alumniList.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (Batch: {a.batch_year})</option>
                  ))}
                </select>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Hold Ctrl/Cmd to select multiple.</span>
              </div>
              <div className="form-group">
                <label className="form-label required">Message / Summary</label>
                <textarea className="form-control" placeholder="Summarize what was discussed..." value={logForm.message} onChange={e => setLogForm({ ...logForm, message: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Response Received?</label>
                <select className="form-control" value={logForm.response_received} onChange={e => setLogForm({ ...logForm, response_received: e.target.value })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {logForm.response_received === 'yes' && (
                <div className="form-group">
                  <label className="form-label">Response Summary</label>
                  <textarea className="form-control" placeholder="Log response received..." value={logForm.response_summary} onChange={e => setLogForm({ ...logForm, response_summary: e.target.value })} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setShowLogModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Log Interaction</button>
            </div>
          </form>
        </div>
      )}

      {/* ===== VIEW LOG DETAILS MODAL ===== */}
      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: typeColor(selectedLog.type) }}>{typeIcon(selectedLog.type)}</span>
                Outbound Interaction Details
              </div>
              <button className="btn btn-xs" style={{ border: 'none' }} onClick={() => setSelectedLog(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div><strong>Channel:</strong> <span style={{ color: typeColor(selectedLog.type), fontWeight: 600, textTransform: 'capitalize' }}>{selectedLog.type}</span></div>
              <div><strong>Sent On:</strong> {new Date(selectedLog.datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
              <div><strong>Sender Staff:</strong> {selectedLog.staff_initiator}</div>
              <div><strong>Subject:</strong> {selectedLog.subject}</div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                <strong>Message / Content:</strong>
                <p style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '8px', border: '1px solid #cbd5e1', fontSize: '11px', marginTop: '4px', fontFamily: 'monospace' }}>
                  {selectedLog.message}
                </p>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <strong>Recipients:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '4px', fontSize: '11px' }}>
                  {selectedLog.recipients?.map(r => (
                    <li key={r.id}>{r.name} · Batch {r.batch_year} · {r.email || 'no email'}</li>
                  ))}
                </ul>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <strong>Response Status:</strong>{' '}
                <span className={`badge badge-${selectedLog.response_received === 'yes' ? 'active' : selectedLog.response_received === 'pending' ? 'warning' : 'archived'}`}>
                  {selectedLog.response_received}
                </span>
                {selectedLog.response_summary && (
                  <p style={{ fontSize: '11px', color: '#475569', background: '#ecfdf5', padding: '6px', marginTop: '4px', border: '1px solid #a7f3d0' }}>
                    <strong>Feedback:</strong> {selectedLog.response_summary}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
