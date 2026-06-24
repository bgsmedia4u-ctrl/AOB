import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { logAudit } from '../server.js';

const router = express.Router();

// Middleware to check authentication
export function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
}

// Middleware to verify role authorization
export function requireRole(allowedRoles) {
  return [
    isAuthenticated,
    (req, res, next) => {
      const userRole = req.session.user.role;
      if (allowedRoles.includes(userRole)) {
        next();
      } else {
        res.status(403).json({ error: `Forbidden. Requires one of these roles: ${allowedRoles.join(', ')}` });
      }
    }
  ];
}

// Login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      await logAudit(username, 'Guest', 'LOGIN_FAILURE', `Attempted login for non-existent user: ${username}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit(username, 'Guest', 'LOGIN_FAILURE', `Invalid password attempt for user: ${username}`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Set user session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    await logAudit(user.username, user.role, 'LOGIN_SUCCESS', `Successfully logged in.`);
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Logout route
router.post('/logout', isAuthenticated, async (req, res) => {
  const { username, role } = req.session.user;

  req.session.destroy(async (err) => {
    if (err) {
      console.error('Logout session destruction error:', err);
      return res.status(500).json({ error: 'Could not log out.' });
    }
    
    await logAudit(username, role, 'LOGOUT', 'Successfully logged out.');
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Check session state
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated.' });
  }
});

// Extend session lifetime (touch request)
router.post('/touch', isAuthenticated, (req, res) => {
  req.session.touch();
  res.json({ message: 'Session extended successfully.' });
});

export default router;
