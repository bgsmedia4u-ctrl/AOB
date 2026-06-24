import React, { useState, useEffect } from 'react';
import { MessageSquare, Filter, Plus, X, Eye, PhoneCall, Mail, MessageCircle, MapPin } from 'lucide-react';

export default function Communications({ user, triggerToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alumniList, setAlumniList] = useState([]);

  // Filters state
  const [filterType, setFilterType] = useState('');
  const [filterResponse, setFilterResponse] = useState('');
  const [filterStaff, setFilterStaff] = useState('');

  // Manual Logger form modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null); // for viewing log details
  
  const [logForm, setLogForm] = useState({
    type: 'phone call',
    datetime: '',
    subject: '',
    message: '',
    response_received: 'no',
    response_summary: '',
    alumni_ids: []
  });

  useEffect(() => {
    fetchLogs();
    fetchAllAlumni();
  }, [filterType, filterResponse, filterStaff]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterResponse) params.append('response_received', filterResponse);
      if (filterStaff) params.append('staff_initiator', filterStaff);

      const res = await fetch(`/api/communications/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error loading communication archives.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAlumni = async () => {
    try {
      const res = await fetch('/api/alumni');
      if (res.ok) {
        const data = await res.json();
        setAlumniList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenLogModal = () => {
    setLogForm({
      type: 'phone call',
      datetime: new Date().toISOString().slice(0, 16),
      subject: '',
      message: '',
      response_received: 'no',
      response_summary: '',
      alumni_ids: []
    });
    setShowLogModal(true);
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!logForm.subject || !logForm.message) {
      triggerToast('Communication subject and summary description are required fields.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/communications/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logForm)
      });

      if (res.ok) {
        triggerToast('Manual interaction communication logged.');
        setShowLogModal(false);
        fetchLogs();
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to log communication details.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error logging communication.', 'error');
    }
  };

  const handleAlumniMultiSelect = (e) => {
    const options = e.target.options;
    const selectedIds = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedIds.push(parseInt(options[i].value));
      }
    }
    setLogForm({ ...logForm, alumni_ids: selectedIds });
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <MessageSquare size={16} />
          Outbound Communications Log Directory
        </div>
        <div className="workspace-actions">
          {user.role !== 'Viewer' && (
            <button className="btn btn-primary" onClick={handleOpenLogModal}>
              <Plus size={13} />
              Log Manual Interaction
            </button>
          )}
        </div>
      </header>

      <div className="workspace-content">
        {/* Filters */}
        <div className="control-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} style={{ color: '#64748b' }} />
            <span style={{ fontWeight: 600, fontSize: '11px', color: '#475569' }}>FILTERS:</span>
          </div>

          <select 
            className="form-control filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="email">Email</option>
            <option value="SMS">SMS</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="phone call">Phone Call</option>
            <option value="in-person">In-Person</option>
          </select>

          <select 
            className="form-control filter-select"
            value={filterResponse}
            onChange={(e) => setFilterResponse(e.target.value)}
          >
            <option value="">All Responses</option>
            <option value="yes">Response Received</option>
            <option value="no">No Response</option>
            <option value="pending">Pending</option>
          </select>

          <input 
            type="text"
            className="form-control"
            placeholder="Staff initiator..."
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            style={{ width: '130px' }}
          />
        </div>

        {/* Table list */}
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
                  <th>Feedback Response</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {new Date(log.datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).slice(0, 17)}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {log.type === 'email' && <Mail size={11} />}
                        {log.type === 'SMS' && <MessageSquare size={11} />}
                        {log.type === 'WhatsApp' && <MessageCircle size={11} />}
                        {log.type === 'phone call' && <PhoneCall size={11} />}
                        {log.type === 'in-person' && <MapPin size={11} />}
                        {log.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.subject}</td>
                    <td>{log.staff_initiator}</td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.recipients && log.recipients.length > 0 
                        ? log.recipients.map(r => r.name).join(', ')
                        : 'None'
                      }
                    </td>
                    <td>
                      <span className={`badge badge-${log.response_received === 'yes' ? 'active' : log.response_received === 'pending' ? 'warning' : 'archived'}`}>
                        {log.response_received}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-xs" onClick={() => setSelectedLog(log)}>
                        <Eye size={11} /> View Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Manual log modal */}
      {showLogModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSaveLog} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">Log Offline Interaction Communication</div>
              <button type="button" className="btn btn-xs" style={{ border: 'none' }} onClick={() => setShowLogModal(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label required">Type / Channel</label>
                  <select 
                    className="form-control" 
                    value={logForm.type}
                    onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                  >
                    <option value="phone call">Phone Call</option>
                    <option value="in-person">In-Person</option>
                    <option value="SMS">SMS</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Date & Time</label>
                  <input 
                    type="datetime-local" className="form-control" 
                    value={logForm.datetime}
                    onChange={(e) => setLogForm({ ...logForm, datetime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label required">Subject / Purpose</label>
                <input 
                  type="text" className="form-control" 
                  placeholder="e.g. general info validation check"
                  value={logForm.subject}
                  onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Link Recipient(s)</label>
                <select 
                  multiple 
                  className="form-control" 
                  value={logForm.alumni_ids}
                  onChange={handleAlumniMultiSelect}
                  style={{ height: '80px' }}
                >
                  {alumniList.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (Batch: {a.batch_year}, Stream: {a.stream})</option>
                  ))}
                </select>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Hold Ctrl/Cmd to select multiple profiles.</span>
              </div>

              <div className="form-group">
                <label className="form-label required">Message Content / summary</label>
                <textarea 
                  className="form-control" 
                  placeholder="Summarize what was sent or discussed..."
                  value={logForm.message}
                  onChange={(e) => setLogForm({ ...logForm, message: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Response Received?</label>
                  <select 
                    className="form-control" 
                    value={logForm.response_received}
                    onChange={(e) => setLogForm({ ...logForm, response_received: e.target.value })}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              {logForm.response_received === 'yes' && (
                <div className="form-group">
                  <label className="form-label">Response Summary</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Log detail of the response received..."
                    value={logForm.response_summary}
                    onChange={(e) => setLogForm({ ...logForm, response_summary: e.target.value })}
                  />
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

      {/* View log details modal */}
      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">Outbound Interaction Log Details</div>
              <button className="btn btn-xs" style={{ border: 'none' }} onClick={() => setSelectedLog(null)}>
                <X size={14} />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <strong>Channel Type:</strong> <span style={{ textTransform: 'capitalize' }}>{selectedLog.type}</span>
              </div>
              <div>
                <strong>Sent On:</strong> {new Date(selectedLog.datetime).toLocaleString()}
              </div>
              <div>
                <strong>Sender Staff:</strong> {selectedLog.staff_initiator}
              </div>
              <div>
                <strong>Subject:</strong> {selectedLog.subject}
              </div>
              
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                <strong>Message Content / Outlines:</strong>
                <p style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f8fafc', padding: '8px', border: '1px solid #cbd5e1', fontSize: '11px', marginTop: '4px', fontFamily: 'monospace' }}>
                  {selectedLog.message}
                </p>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <strong>Recipients:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '4px', fontSize: '11px' }}>
                  {selectedLog.recipients?.map(r => (
                    <li key={r.id}>{r.name} (Batch: {r.batch_year}, Email: {r.email})</li>
                  ))}
                </ul>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <strong>Response Status:</strong> <span className="badge badge-active">{selectedLog.response_received}</span>
                {selectedLog.response_summary && (
                  <p style={{ fontSize: '11px', color: '#475569', backgroundColor: '#ecfdf5', padding: '6px', marginTop: '4px', border: '1px solid #a7f3d0' }}>
                    <strong>Feedback response:</strong> {selectedLog.response_summary}
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
