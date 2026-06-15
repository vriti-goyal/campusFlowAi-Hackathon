import express from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { PlacementNotice } from '../models/PlacementNotice.js';
import { isPlacementEmail, parseEmailWithAI, checkEligibility } from '../services/placementParser.js';

const router = express.Router();

// ── Encryption helpers (AES-256-GCM) ────────────────────────────────────────

const ENCRYPTION_KEY = Buffer.from(
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
  'hex'
);

function encryptToken(token) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptToken(stored) {
  const [ivHex, authTagHex, encryptedHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// ── OAuth2 Client factory ────────────────────────────────────────────────────

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/gmail/auth-url
 * Returns a Google OAuth2 consent URL for gmail.readonly scope.
 * The state parameter encodes the user's Firebase UID for the callback.
 */
router.get('/auth-url', verifyFirebaseToken, (req, res) => {
  const oAuth2Client = createOAuthClient();
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent', // Always show consent to ensure we get a refresh token
    state: req.user.firebaseUid,
  });
  res.json({ url });
});

/**
 * GET /api/gmail/callback
 * OAuth2 redirect URI. Exchanges code for tokens, encrypts and stores refresh token.
 * Redirects back to the frontend after success/failure.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.error('[Gmail OAuth] User denied consent:', error);
    return res.redirect(`${frontendUrl}/placement-notices?gmail=denied`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/placement-notices?gmail=error`);
  }

  try {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('[Gmail OAuth] No refresh token received. User may have already consented.');
      return res.redirect(`${frontendUrl}/placement-notices?gmail=no_refresh_token`);
    }

    const encryptedToken = encryptToken(tokens.refresh_token);

    await User.findOneAndUpdate(
      { firebaseUid: state },
      {
        gmailRefreshToken: encryptedToken,
        gmailConnected: true,
      }
    );

    console.log(`[Gmail OAuth] Connected Gmail for user uid=${state}`);
    return res.redirect(`${frontendUrl}/placement-notices?gmail=connected`);
  } catch (err) {
    console.error('[Gmail OAuth] Callback error:', err.message);
    return res.redirect(`${frontendUrl}/placement-notices?gmail=error`);
  }
});

/**
 * POST /api/gmail/sync
 * Fetches recent emails from the connected Gmail, filters by placement keywords,
 * stores new emails in PlacementNotice, and runs AI parsing + eligibility check.
 */
router.post('/sync', verifyFirebaseToken, async (req, res) => {
  const user = req.user;

  if (!user.gmailConnected || !user.gmailRefreshToken) {
    return res.status(400).json({ error: 'Gmail not connected. Please connect your Gmail account first.' });
  }

  try {
    // Decrypt the stored refresh token
    const refreshToken = decryptToken(user.gmailRefreshToken);

    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    let query = 'newer_than:30d';
    if (user.tnpEmail) {
      const emails = user.tnpEmail.split(',').map(e => e.trim()).filter(Boolean);
      if (emails.length > 0) {
        const fromQuery = emails.map(e => `from:${e}`).join(' OR ');
        query += ` (${fromQuery})`;
      }
    }

    // Fetch last 50 messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: query,
    });

    const messages = listResponse.data.messages || [];
    let newCount = 0;
    let parsedCount = 0;
    const backgroundTasks = [];

    for (const msg of messages) {
      try {
        // Check if already stored
        const existing = await PlacementNotice.findOne({ userId: user._id, emailId: msg.id });
        if (existing) continue;

        // Fetch full message
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = fullMsg.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const dateHeader = headers.find((h) => h.name === 'Date')?.value;
        const receivedAt = dateHeader ? new Date(dateHeader) : new Date();

        // Extract body text (prefer plain text, fallback to snippet)
        let rawBody = fullMsg.data.snippet || '';
        const parts = fullMsg.data.payload?.parts || [];
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            rawBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
        // If no parts, check the body directly
        if (!rawBody && fullMsg.data.payload?.body?.data) {
          rawBody = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
        }

        // Filter by placement keywords
        if (!isPlacementEmail(subject, rawBody)) continue;

        // Store the raw email
        const notice = await PlacementNotice.create({
          userId: user._id,
          emailId: msg.id,
          subject,
          receivedAt,
          rawBody,
          eligibilityStatus: 'pending',
        });

        newCount++;
        backgroundTasks.push({ notice, rawBody, user });
      } catch (msgErr) {
        console.error('[Gmail Sync] Error processing message', msg.id, msgErr.message);
      }
    }

    if (backgroundTasks.length > 0) {
      setImmediate(async () => {
        for (const task of backgroundTasks) {
          try {
            const parsed = await parseEmailWithAI(task.rawBody);
            const { status, breakdown } = parsed
              ? checkEligibility(parsed, task.user)
              : { status: 'partial', breakdown: {} };

            await PlacementNotice.findByIdAndUpdate(task.notice._id, {
              parsed,
              eligibilityStatus: status,
            });

            parsedCount++;
            console.log(`[Gmail Sync] Parsed notice ${task.notice._id}: ${status}`);
            
            // Delay 5 seconds to prevent Google IP rate limits
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (parseErr) {
            console.error('[Gmail Sync] Parse error for notice', task.notice._id, parseErr.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      });
    }

    res.json({
      message: `Sync complete. Found ${newCount} new placement emails. AI parsing running in background.`,
      newEmails: newCount,
    });
  } catch (err) {
    console.error('[Gmail Sync] Error:', err.message);

    // If the refresh token is invalid/revoked, reset connected state
    if (err.message?.includes('invalid_grant') || err.code === 401) {
      await User.findByIdAndUpdate(user._id, { gmailConnected: false, gmailRefreshToken: null });
      return res.status(401).json({ error: 'Gmail token expired or revoked. Please reconnect your Gmail.' });
    }

    res.status(500).json({ error: 'Failed to sync Gmail. Please try again.' });
  }
});

/**
 * DELETE /api/gmail/disconnect
 * Revokes Gmail access and clears the stored token.
 * Requires body: { confirm: true } as a safety check.
 */
router.delete('/disconnect', verifyFirebaseToken, async (req, res) => {
  if (!req.body.confirm) {
    return res.status(400).json({ error: 'Must send { confirm: true } to disconnect Gmail.' });
  }

  try {
    if (req.user.gmailRefreshToken) {
      try {
        // Best-effort revoke
        const refreshToken = decryptToken(req.user.gmailRefreshToken);
        const oAuth2Client = createOAuthClient();
        await oAuth2Client.revokeToken(refreshToken);
      } catch (revokeErr) {
        console.warn('[Gmail Disconnect] Token revocation failed (may already be revoked):', revokeErr.message);
      }
    }

    await User.findByIdAndUpdate(req.user._id, {
      gmailConnected: false,
      gmailRefreshToken: null,
    });

    res.json({ message: 'Gmail disconnected successfully.' });
  } catch (err) {
    console.error('[Gmail Disconnect] Error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Gmail.' });
  }
});

/**
 * GET /api/gmail/status
 * Returns whether the user has Gmail connected.
 */
router.get('/status', verifyFirebaseToken, (req, res) => {
  res.json({ connected: req.user.gmailConnected || false });
});

export default router;
