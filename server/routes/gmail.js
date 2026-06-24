import express from 'express';
import { oauth2Client } from '../gmail-config.js';

const router = express.Router();

// STEP 1: Visit this route once — it will redirect you to Google's consent screen
// Only needs to be done once to get the refresh token
router.get('/auth-url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent screen to always get refresh_token
    scope: ['https://www.googleapis.com/auth/gmail.send']
  });
  res.redirect(url); // Redirect directly to Google
});

// STEP 2: Google redirects here after user consents
// Copy the 'refresh_token' from the response and set GOOGLE_REFRESH_TOKEN in your .env
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code from Google.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('===== GOOGLE OAUTH TOKENS =====');
    console.log(JSON.stringify(tokens, null, 2));
    console.log('================================');
    console.log('IMPORTANT: Copy the refresh_token above and set it as GOOGLE_REFRESH_TOKEN in your Render environment variables.');

    res.send(`
      <h2>✅ Gmail Authorization Successful!</h2>
      <p>Your refresh token has been logged to the Render console.</p>
      <p>Go to your <strong>Render Dashboard → Environment Variables</strong> and add:</p>
      <pre>GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token || '(check Render logs - token printed there)'}</pre>
      <p>After setting it, redeploy the server and Gmail sending will be fully activated.</p>
    `);
  } catch (err) {
    console.error('Gmail OAuth callback error:', err);
    res.status(500).send('OAuth token exchange failed. Check server logs.');
  }
});

export default router;
