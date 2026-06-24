import React, { useState, useEffect, useRef } from 'react';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import AlumniList from './views/AlumniList';
import Meetings from './views/Meetings';
import Communications from './views/Communications';
import AuditLogs from './views/AuditLogs';
import Templates from './views/Templates';
import { 
  Users, 
  BarChart3, 
  Calendar, 
  MessageSquare, 
  History, 
  FileEdit,
  LogOut, 
  ShieldAlert,
  Bell
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  
  // Session tracking state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300); // 5 minutes warning
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Helper to trigger toast notification
  const triggerToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Check login session on mount
  useEffect(() => {
    checkSession();
    
    // Add user activity listeners
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousemove', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      clearInterval(warningTimerRef.current);
      clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Check session state on backend
  const checkSession = async () => {
    try {
      const res = await fetch('/api/session-check');
      const data = await res.json();
      if (data.loggedIn) {
        setUser(data.user);
        resetSessionTimers();
      } else {
        setUser(null);
        clearSessionTimers();
      }
    } catch (err) {
      console.error('Session check failed', err);
    } finally {
      setLoading(false);
    }
  };

  // Touch session on backend to extend it
  const touchSession = async () => {
    try {
      const res = await fetch('/api/auth/touch', { method: 'POST' });
      if (res.ok) {
        setShowSessionWarning(false);
        resetSessionTimers();
        triggerToast('Session extended successfully.');
      } else {
        handleLogout(true);
      }
    } catch (err) {
      console.error('Touch session failed', err);
      handleLogout(true);
    }
  };

  // Reset timers for timeout checking
  const resetSessionTimers = () => {
    clearInterval(warningTimerRef.current);
    clearInterval(countdownTimerRef.current);
    setShowSessionWarning(false);
    lastActivityRef.current = Date.now();

    // Inactivity check: Warn user after 25 minutes of inactivity (1500 seconds)
    warningTimerRef.current = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= 25 * 60 * 1000) { // 25 minutes
        setShowSessionWarning(true);
        setSecondsRemaining(300); // 5 minutes count down
        startCountdown();
        clearInterval(warningTimerRef.current);
      }
    }, 10000); // Check every 10s
  };

  // Countdown timer for session timeout
  const startCountdown = () => {
    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          handleLogout(true); // force logout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearSessionTimers = () => {
    clearInterval(warningTimerRef.current);
    clearInterval(countdownTimerRef.current);
    setShowSessionWarning(false);
  };

  const handleLogout = async (forced = false) => {
    clearSessionTimers();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed', err);
    }
    setUser(null);
    if (forced) {
      alert('Your session has expired due to 30 minutes of inactivity. Please log in again.');
    } else {
      triggerToast('Logged out successfully.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'monospace', fontSize: '14px' }}>INITIALIZING BGS ALUMNI DATABASE SERVICE...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => { setUser(u); resetSessionTimers(); }} triggerToast={triggerToast} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">BGS PU COLLEGE</div>
          <div className="sidebar-sublogo">Alumni Registry System</div>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`sidebar-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <BarChart3 size={16} />
            Analytics Dashboard
          </button>
          
          <button 
            className={`sidebar-item ${currentView === 'directory' ? 'active' : ''}`}
            onClick={() => setCurrentView('directory')}
          >
            <Users size={16} />
            Alumni Directory
          </button>

          <button 
            className={`sidebar-item ${currentView === 'meetings' ? 'active' : ''}`}
            onClick={() => setCurrentView('meetings')}
          >
            <Calendar size={16} />
            Meetings Scheduler
          </button>

          <button 
            className={`sidebar-item ${currentView === 'communications' ? 'active' : ''}`}
            onClick={() => setCurrentView('communications')}
          >
            <MessageSquare size={16} />
            Communication Log
          </button>

          <button 
            className={`sidebar-item ${currentView === 'templates' ? 'active' : ''}`}
            onClick={() => setCurrentView('templates')}
          >
            <FileEdit size={16} />
            Email Templates
          </button>

          {user.role === 'Super Admin' && (
            <button 
              className={`sidebar-item ${currentView === 'audit' ? 'active' : ''}`}
              onClick={() => setCurrentView('audit')}
            >
              <History size={16} />
              Audit Logs
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-name">{user.username}</div>
          <div className="sidebar-user-role">{user.role}</div>
          <button className="sidebar-logout-btn" onClick={() => handleLogout(false)}>
            <LogOut size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Log Out Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-workspace">
        {currentView === 'dashboard' && <Dashboard user={user} triggerToast={triggerToast} />}
        {currentView === 'directory' && <AlumniList user={user} triggerToast={triggerToast} />}
        {currentView === 'meetings' && <Meetings user={user} triggerToast={triggerToast} />}
        {currentView === 'communications' && <Communications user={user} triggerToast={triggerToast} />}
        {currentView === 'templates' && <Templates user={user} triggerToast={triggerToast} />}
        {currentView === 'audit' && user.role === 'Super Admin' && <AuditLogs user={user} />}
      </main>

      {/* Session Inactivity Warning Modal */}
      {showSessionWarning && (
        <div className="modal-overlay">
          <div className="modal-content session-modal">
            <div className="modal-header" style={{ backgroundColor: '#fee2e2' }}>
              <div className="modal-title" style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} />
                Inactivity Warning
              </div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', marginBottom: '8px' }}>
                Your administrative session has been idle. For compliance and security, you will be automatically logged out in:
              </p>
              <h3 style={{ fontFamily: 'monospace', fontSize: '20px', color: '#b91c1c', textAlign: 'center', margin: '12px 0' }}>
                {Math.floor(secondsRemaining / 60)}m {secondsRemaining % 60}s
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b' }}>
                Click 'Stay Logged In' below to renew your security session token.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => handleLogout(false)}>Log Out</button>
              <button className="btn btn-primary" onClick={touchSession}>Stay Logged In</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}
