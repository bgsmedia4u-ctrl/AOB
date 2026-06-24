import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLoginSuccess, triggerToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Both username and password are required fields.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        triggerToast('Authentication successful. Welcome to the portal.');
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Invalid credentials. Access Denied.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to the authentication service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">BGS PU COLLEGE</div>
        <div className="login-sublogo">Alumni Registry Console</div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="username"
                type="text"
                className="form-control"
                placeholder="Enter staff ID or username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                style={{ paddingLeft: '28px' }}
                autoComplete="username"
              />
              <User size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: '#64748b' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                style={{ paddingLeft: '28px', paddingRight: '28px' }}
                autoComplete="current-password"
              />
              <Lock size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: '#64748b' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '8px', top: '7px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={13} style={{ color: '#64748b' }} /> : <Eye size={13} style={{ color: '#64748b' }} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', height: '32px', marginBottom: '16px' }}
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.4' }}>
            <strong>Institutional Compliance Policy:</strong><br />
            For security, passwords must be changed every 90 days and must contain at least 8 characters, including 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
          </p>
        </div>
      </div>
    </div>
  );
}
