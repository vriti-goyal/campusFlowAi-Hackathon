import express from 'express';
import { getOAuthClient, getAuthUrl } from '../config/googleOAuth.js';
import GmailToken from '../models/GmailToken.js';
import { Placement } from '../models/Placement.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { StudentPlacementStatus } from '../models/StudentPlacementStatus.js';
import { BatchMember } from '../models/BatchMember.js';
import { google } from 'googleapis';
import { invokeAI } from '../config/gemini.js';
import { calculatePriorityScore } from '../services/priorityScore.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();

router.get('/auth-url', (req, res) => {
  try {
    const oauthClient = getOAuthClient();
    const authUrl = getAuthUrl(oauthClient);
    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate auth url' });
  }
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (!code) return res.redirect(`${frontendUrl}/placements?gmail=error`);

  try {
    const oauthClient = getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauthClient, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    
    await GmailToken.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date,
        email: userInfo.data.email,
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.redirect(`${frontendUrl}/placements?gmail=connected`);
  } catch (err) {
    console.error('Gmail OAuth Callback Error:', err);
    res.redirect(`${frontendUrl}/placements?gmail=error`);
  }
});

router.get('/status', async (req, res) => {
  try {
    const token = await GmailToken.findOne({ userId: req.user._id });
    if (!token) return res.json({ connected: false, email: null, lastSync: null });

    // Try to find the latest synced placement for this user (we could track this in GmailToken but for now just simple logic or connectedAt)
    res.json({ connected: true, email: token.email, lastSync: token.connectedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const tokenDoc = await GmailToken.findOne({ userId: req.user._id });
    if (!tokenDoc) return res.status(400).json({ error: 'Gmail not connected' });

    const oauthClient = getOAuthClient();
    oauthClient.setCredentials({
      access_token: tokenDoc.accessToken,
      refresh_token: tokenDoc.refreshToken,
      expiry_date: tokenDoc.expiryDate
    });

    // Check if refresh is needed handled automatically by googleapis if refresh_token is set
    const gmail = google.gmail({ version: 'v1', auth: oauthClient });

    const queries = [
      'subject:placement OR subject:hiring OR subject:recruitment OR subject:drive',
      'subject:internship OR subject:opportunity OR subject:campus placement'
    ];

    const messageIds = new Set();
    
    for (const query of queries) {
      try {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 20
        });
        const msgs = response.data.messages || [];
        msgs.forEach(m => messageIds.add(m.id));
      } catch (err) {
        console.error('Error fetching messages for query', query, err);
      }
    }

    let processed = 0;
    let added = 0;
    let skipped = 0;
    const errors = [];

    // Get user batch
    const batchMember = await BatchMember.findOne({ userId: req.user._id });
    const batchId = batchMember ? batchMember.batchId : null;

    for (const id of messageIds) {
      // Check if already processed
      const existingPlacement = await Placement.findOne({ sourceId: id });
      if (existingPlacement) {
        skipped++;
        continue;
      }

      processed++;
      
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const headers = msg.data.payload.headers;
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
        
        let rawBody = '';
        const extractBody = (part) => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            rawBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
            return true;
          }
          if (part.parts) {
            for (let subPart of part.parts) {
              if (extractBody(subPart)) return true;
            }
          }
          return false;
        };
        
        if (msg.data.payload.parts) {
          extractBody(msg.data.payload);
        } else if (msg.data.payload.body?.data) {
          rawBody = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
        }

        rawBody = rawBody.replace(/<[^>]*>?/gm, ''); // strip HTML
        rawBody = rawBody.substring(0, 2000); // Truncate

        const prompt = `You are CampusFlow AI Placement Extractor.
Extract placement details from this email. Return ONLY valid JSON, no markdown.

{
  "company": "",
  "role": "",
  "package": "",
  "eligibleBranches": [],
  "minimumCgpa": null,
  "allowedBacklogs": 0,
  "deadline": "",
  "testDate": "",
  "applicationLink": "",
  "actionRequired": "",
  "isPlacementEmail": true/false,
  "confidence": 0-100
}

If this is NOT a placement/hiring email, set isPlacementEmail: false.
Only extract real values — use null/empty string if not mentioned.

Email Subject: ${subject}
Email Body: ${rawBody}`;

        const aiResponse = await invokeAI(prompt, 1024);
        let cleanedJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const extracted = JSON.parse(cleanedJson);

        if (!extracted.isPlacementEmail || extracted.confidence < 50) {
          skipped++;
          continue;
        }

        // Duplicate check by company (case-insensitive) and batchId
        if (extracted.company) {
            const dupeCheck = await Placement.findOne({
                company: { $regex: new RegExp(`^${extracted.company}$`, 'i') },
                batchId
            });
            if (dupeCheck) {
                skipped++;
                continue;
            }
        }

        const { priorityScore } = calculatePriorityScore({ deadline: extracted.deadline, category: 'Placement', verified: false });

        const newPlacement = await Placement.create({
          batchId,
          postId: null,
          source: 'gmail',
          sourceId: id,
          company: extracted.company || 'Unknown Company',
          role: extracted.role || '',
          package: extracted.package || '',
          eligibleBranches: extracted.eligibleBranches || [],
          minimumCgpa: extracted.minimumCgpa || 0,
          allowedBacklogs: extracted.allowedBacklogs || 0,
          deadline: extracted.deadline ? new Date(extracted.deadline) : null,
          testDate: extracted.testDate ? new Date(extracted.testDate) : null,
          applicationLink: extracted.applicationLink || '',
          status: 'active',
          priorityScore
        });

        if (extracted.deadline) {
          await CalendarEvent.create({
            userId: req.user._id,
            batchId,
            title: `Placement Deadline: ${newPlacement.company}`,
            category: 'placement',
            date: new Date(extracted.deadline),
            sourceType: 'placement',
            sourceId: newPlacement._id,
            status: 'upcoming'
          });
        }

        await createNotification(req.user._id, {
          title: `New Placement: ${newPlacement.company}`,
          message: `Scanned from Gmail: ${newPlacement.role || 'Placement Opportunity'}`,
          type: 'placement',
          priority: 'medium'
        });

        // Compute eligibility
        const meetsGpa = (req.user.cgpa || 0) >= newPlacement.minimumCgpa;
        const meetsBranch = !newPlacement.eligibleBranches.length || newPlacement.eligibleBranches.includes(req.user.branch || '');
        const eligibilityStatus = meetsGpa && meetsBranch ? 'eligible' : 'not_eligible';

        await StudentPlacementStatus.create({
          userId: req.user._id,
          placementId: newPlacement._id,
          eligibilityStatus,
          status: 'Not Applied'
        });

        added++;
      } catch (err) {
        console.error('Error processing message ID:', id, err);
        errors.push({ id, error: err.message });
      }
    }

    res.json({ processed, added, skipped, errors });
  } catch (err) {
    console.error('Gmail Sync Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
