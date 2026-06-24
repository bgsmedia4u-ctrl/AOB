import React, { useState, useEffect } from 'react';
import { History, Search, ArrowLeft, ArrowRight } from 'lucide-react';

export default function AuditLogs({ user }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Pagination state
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [offset, limit]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0); // reset page
    fetchLogs();
  };

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(prev => prev - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(prev => prev + limit);
    }
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-title">
          <History size={16} />
          Institutional Audit Logs & Compliance Trail
        </div>
      </header>

      <div className="workspace-content">
        {/* Search Bar */}
        <form className="control-bar" onSubmit={handleSearchSubmit}>
          <div style={{ position: 'relative', width: '320px' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by staff username, action, details..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '24px' }}
            />
            <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#64748b' }} />
          </div>
          <button type="submit" className="btn btn-primary">Search logs</button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748b' }}>
            <span>
              Showing {logs.length > 0 ? offset + 1 : 0} - {Math.min(offset + limit, total)} of {total} events
            </span>
            <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
              <button 
                type="button" 
                className="btn btn-xs" 
                onClick={handlePrevPage} 
                disabled={offset === 0 || loading}
              >
                <ArrowLeft size={11} />
              </button>
              <button 
                type="button" 
                className="btn btn-xs" 
                onClick={handleNextPage} 
                disabled={offset + limit >= total || loading}
              >
                <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </form>

        {/* Table logs */}
        <div className="table-container">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'monospace' }}>RETRIEVING COMPLIANCE TRAILS...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No audit logs logged.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Timestamp (IST)</th>
                  <th style={{ width: '100px' }}>Staff Username</th>
                  <th style={{ width: '110px' }}>Staff Role</th>
                  <th style={{ width: '150px' }}>Action Type</th>
                  <th>Description Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{log.username}</td>
                    <td>
                      <span className={`badge ${log.role === 'Super Admin' ? 'badge-archived' : log.role === 'Admin' ? 'badge-info' : 'badge-active'}`}>
                        {log.role}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>{log.action_type}</td>
                    <td style={{ whiteSpace: 'normal', color: '#475569' }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
