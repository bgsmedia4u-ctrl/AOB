import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  List, 
  Plus, 
  X, 
  Clock, 
  CheckCircle2, 
  User, 
  Video, 
  Phone, 
  MapPin, 
  RefreshCw,
  Bell
} from 'lucide-react';

export default function Meetings({ user, triggerToast }) {
  const [meetings, setMeetings] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  
  // Date tracking for Calendar view
  const [currentDate, setCurrentDate] = useState(new Date());

  // Scheduler Form Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [alumniList, setAlumniList] = useState([]); // list of all alumni for multi-select link
  
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    datetime: '',
    format: 'video call',
    staff_responsible: user.username,
    notes: '',
    status: 'scheduled',
    outcome: '',
    recurrence: 'none',
    alumni_ids: []
  });

  useEffect(() => {
    fetchMeetings();
    fetchReminders();
    fetchAllAlumni();
  }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error loading scheduled interactions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/meetings/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (err) {
      console.error(err);
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

  const handleCreateClick = () => {
    setEditingMeetingId(null);
    setMeetingForm({
      title: '',
      datetime: '',
      format: 'video call',
      staff_responsible: user.username,
      notes: '',
      status: 'scheduled',
      outcome: '',
      recurrence: 'none',
      alumni_ids: []
    });
    setShowForm(true);
  };

  const handleEditClick = (meet) => {
    setEditingMeetingId(meet.id);
    setMeetingForm({
      title: meet.title,
      datetime: meet.datetime,
      format: meet.format,
      staff_responsible: meet.staff_responsible,
      notes: meet.notes || '',
      status: meet.status,
      outcome: meet.outcome || '',
      recurrence: meet.recurrence || 'none',
      alumni_ids: meet.linked_alumni ? meet.linked_alumni.map(a => a.id) : []
    });
    setShowForm(true);
  };

  const handleSaveMeeting = async (e) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.datetime || !meetingForm.staff_responsible) {
      triggerToast('Meeting title, date/time, and responsible staff are mandatory fields.', 'error');
      return;
    }

    try {
      const url = editingMeetingId ? `/api/meetings/${editingMeetingId}` : '/api/meetings';
      const method = editingMeetingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meetingForm)
      });

      if (res.ok) {
        triggerToast(editingMeetingId ? 'Meeting updated.' : 'Meeting scheduled successfully.');
        setShowForm(false);
        fetchMeetings();
        fetchReminders();
      } else {
        const data = await res.json();
        triggerToast(data.error || 'Failed to save meeting details.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error saving scheduler entry.', 'error');
    }
  };

  const handleDeleteMeeting = async (id) => {
    if (!confirm('Are you sure you want to cancel and remove this scheduled interaction?')) return;
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerToast('Meeting deleted.');
        setShowForm(false);
        fetchMeetings();
        fetchReminders();
      }
    } catch (err) {
      console.error(err);
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
    setMeetingForm({ ...meetingForm, alumni_ids: selectedIds });
  };

  // Monthly calendar calculation helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, etc.
    
    // Total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Previous month filler days
    const prevMonthDays = [];
    const prevMonthTotal = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push({ day: prevMonthTotal - i, currentMonth: false, date: new Date(year, month - 1, prevMonthTotal - i) });
    }

    // Current month days
    const currentDays = [];
    for (let d = 1; d <= totalDays; d++) {
      currentDays.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
    }

    // Next month filler days (to make grid complete multiple of 7, up to 42 cells)
    const nextDays = [];
    const remaining = 42 - (prevMonthDays.length + currentDays.length);
    for (let d = 1; d <= remaining; d++) {
      nextDays.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
    }

    return [...prevMonthDays, ...currentDays, ...nextDays];
  };

  const calendarDays = getDaysInMonth(currentDate);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Match meeting to date (ignores hours)
  const getMeetingsForDate = (date) => {
    const dateStr = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
    return meetings.filter(m => m.datetime.slice(0, 10) === dateStr);
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <CalendarIcon size={16} />
          Interactions & Meeting Scheduler
        </div>
        <div className="workspace-actions">
          <div className="btn-group" style={{ display: 'flex', border: '1px solid #cbd5e1' }}>
            <button 
              className={`btn btn-xs ${viewMode === 'calendar' ? 'btn-primary' : ''}`} 
              onClick={() => setViewMode('calendar')}
              style={{ border: 'none' }}
            >
              <CalendarIcon size={12} /> Grid
            </button>
            <button 
              className={`btn btn-xs ${viewMode === 'list' ? 'btn-primary' : ''}`} 
              onClick={() => setViewMode('list')}
              style={{ border: 'none' }}
            >
              <List size={12} /> List
            </button>
          </div>

          {user.role !== 'Viewer' && (
            <button className="btn btn-primary" onClick={handleCreateClick}>
              <Plus size={13} />
              Schedule Meeting
            </button>
          )}
        </div>
      </header>

      <div className="workspace-content" style={{ display: 'flex', flexDirection: 'row', gap: '16px', padding: '12px 16px', overflow: 'hidden' }}>
        
        {/* Main Scheduler Area */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* GRID CALENDAR MODE */}
          {viewMode === 'calendar' && (
            <div className="calendar-container">
              <div className="calendar-header">
                <button className="btn btn-xs" onClick={prevMonth}>&lt; Prev</button>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button className="btn btn-xs" onClick={nextMonth}>Next &gt;</button>
              </div>

              <div className="calendar-grid" style={{ gridTemplateRows: 'auto repeat(6, 1fr)' }}>
                {/* Day Labels */}
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(label => (
                  <div key={label} className="calendar-day-label">{label}</div>
                ))}

                {/* Calendar Cells */}
                {calendarDays.map((cell, idx) => {
                  const dayMeetings = getMeetingsForDate(cell.date);
                  return (
                    <div 
                      key={idx} 
                      className={`calendar-cell ${cell.currentMonth ? '' : 'other-month'}`}
                    >
                      <span className="calendar-cell-num">{cell.day}</span>
                      <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayMeetings.map(m => (
                          <div 
                            key={m.id} 
                            className={`calendar-event ${m.status}`}
                            onClick={() => handleEditClick(m)}
                            title={`${m.title} (${m.format})`}
                          >
                            {m.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CHRONOLOGICAL LIST MODE */}
          {viewMode === 'list' && (
            <div className="table-container">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace' }}>RETRIEVING SCHEDULER ENTRIES...</div>
              ) : meetings.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No scheduled meetings logged.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Meeting Title</th>
                      <th>Format</th>
                      <th>Responsible Staff</th>
                      <th>Linked Alumni</th>
                      <th>Status</th>
                      <th>Recurrence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map(m => (
                      <tr key={m.id} onClick={() => handleEditClick(m)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {new Date(m.datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).slice(0, 17)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{m.title}</td>
                        <td style={{ textTransform: 'capitalize' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {m.format === 'video call' && <Video size={11} />}
                            {m.format === 'phone call' && <Phone size={11} />}
                            {m.format === 'in-person' && <MapPin size={11} />}
                            {m.format}
                          </span>
                        </td>
                        <td>{m.staff_responsible}</td>
                        <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.linked_alumni && m.linked_alumni.length > 0 
                            ? m.linked_alumni.map(a => a.name).join(', ')
                            : 'None'
                          }
                        </td>
                        <td>
                          <span className={`badge badge-${m.status === 'completed' ? 'active' : m.status === 'scheduled' ? 'info' : 'archived'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td style={{ textTransform: 'uppercase', fontSize: '10px' }}>{m.recurrence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>

        {/* Sidebar Alerts Panel */}
        <div style={{ width: '260px', border: '1px solid #cbd5e1', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="pane-header" style={{ padding: '8px 12px', borderBottom: '1px solid #cbd5e1' }}>
            <div className="pane-title" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={13} style={{ color: '#b91c1c' }} />
              24-HOUR REMINDERS
            </div>
          </div>
          <div style={{ padding: '12px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reminders.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
                No staff meetings occurring in the next 24 hours.
              </p>
            ) : (
              reminders.map(r => (
                <div key={r.id} style={{ border: '1px solid #fee2e2', backgroundColor: '#fef2f2', padding: '8px', fontSize: '11px' }}>
                  <div style={{ fontWeight: 600, color: '#991b1b' }}>{r.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '4px 0', color: '#64748b' }}>
                    <Clock size={10} />
                    {new Date(r.datetime).toLocaleTimeString().slice(0, 5)}
                  </div>
                  <div>Staff Responsible: <strong>{r.staff_responsible}</strong></div>
                  <div style={{ borderTop: '1px dashed #fca5a5', marginTop: '6px', paddingTop: '4px', color: '#991b1b', fontWeight: 500 }}>
                    Email reminder queued.
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Schedule Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSaveMeeting} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">
                {editingMeetingId ? 'Update Meeting Details' : 'Schedule New Interaction Event'}
              </div>
              <button type="button" className="btn btn-xs" style={{ border: 'none' }} onClick={() => setShowForm(false)}>
                <X size={14} />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label required">Meeting Title / Agenda</label>
                <input 
                  type="text" className="form-control" 
                  placeholder="e.g. annual alumni meet follow up"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  disabled={user.role === 'Viewer'}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label required">Date & Time</label>
                  <input 
                    type="datetime-local" className="form-control" 
                    value={meetingForm.datetime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, datetime: e.target.value })}
                    disabled={user.role === 'Viewer'}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Format</label>
                  <select 
                    className="form-control" 
                    value={meetingForm.format}
                    onChange={(e) => setMeetingForm({ ...meetingForm, format: e.target.value })}
                    disabled={user.role === 'Viewer'}
                    required
                  >
                    <option value="video call">Video Call (Google Meet/Zoom)</option>
                    <option value="phone call">Phone Call</option>
                    <option value="in-person">In-Person (On campus)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label required">Staff Responsible</label>
                  <input 
                    type="text" className="form-control" 
                    value={meetingForm.staff_responsible}
                    onChange={(e) => setMeetingForm({ ...meetingForm, staff_responsible: e.target.value })}
                    disabled={user.role === 'Viewer'}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Recurrence Pattern</label>
                  <select 
                    className="form-control" 
                    value={meetingForm.recurrence}
                    onChange={(e) => setMeetingForm({ ...meetingForm, recurrence: e.target.value })}
                    disabled={user.role === 'Viewer'}
                  >
                    <option value="none">One-off Event</option>
                    <option value="weekly">Weekly Meeting</option>
                    <option value="monthly">Monthly Session</option>
                    <option value="annual">Annual Gathering</option>
                  </select>
                </div>
              </div>

              {/* Linked Alumni (Multi select list) */}
              <div className="form-group">
                <label className="form-label">Link Alumni Profile(s)</label>
                <select 
                  multiple 
                  className="form-control" 
                  value={meetingForm.alumni_ids}
                  onChange={handleAlumniMultiSelect}
                  disabled={user.role === 'Viewer'}
                  style={{ height: '80px' }}
                >
                  {alumniList.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (Batch: {a.batch_year}, Stream: {a.stream})</option>
                  ))}
                </select>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Hold Ctrl/Cmd to select multiple profiles.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Notes & Prep Details</label>
                <textarea 
                  className="form-control" 
                  placeholder="Insert agenda details..."
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                  disabled={user.role === 'Viewer'}
                />
              </div>

              {/* Meeting Completion Outcome Logger */}
              {editingMeetingId && (
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select 
                        className="form-control" 
                        value={meetingForm.status}
                        onChange={(e) => setMeetingForm({ ...meetingForm, status: e.target.value })}
                        disabled={user.role === 'Viewer'}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rescheduled">Rescheduled</option>
                      </select>
                    </div>
                  </div>

                  {meetingForm.status === 'completed' && (
                    <div className="form-group">
                      <label className="form-label">Log Meeting Outcome / Decisions</label>
                      <textarea 
                        className="form-control" 
                        placeholder="Log summary of the discussion..."
                        value={meetingForm.outcome}
                        onChange={(e) => setMeetingForm({ ...meetingForm, outcome: e.target.value })}
                        disabled={user.role === 'Viewer'}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {editingMeetingId && user.role !== 'Viewer' && (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => handleDeleteMeeting(editingMeetingId)}
                  style={{ marginRight: 'auto' }}
                >
                  Remove Meeting
                </button>
              )}
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              {user.role !== 'Viewer' && (
                <button type="submit" className="btn btn-primary">Save Event</button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
