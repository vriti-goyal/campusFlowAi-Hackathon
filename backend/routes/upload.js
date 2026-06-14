import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { uploadToS3 } from '../config/s3.js';
import { invokeAIVision } from '../config/gemini.js';
import { processUpload } from '../services/aiPipeline.js';
import { routeDocument } from '../services/documentRouter.js';
import { Post } from '../models/Post.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Multer — memory storage, max 10 MB, accepted file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, PNG, JPG, JPEG files are accepted'));
  },
});

/**
 * POST /api/upload/file
 * Multipart file upload → S3 → AI pipeline → create Post
 *
 * Uses DocumentClassifier → CourseFilter → DocumentIntelligenceRouter pipeline.
 * Multi-category classification routes documents to appropriate modules.
 * Falls back to general Post creation for unclassified documents.
 */
router.post('/file', verifyFirebaseToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file provided', 400);

    const { batchId, targetType, targetBatchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);

    // Upload to S3
    const fileUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);

    // Extract text via Gemini Vision for document classification
    let extractedText = '';
    try {
      extractedText = await invokeAIVision(req.file.buffer, req.file.mimetype);
    } catch (err) {
      console.error('[Upload] Vision extraction failed:', err.message);
    }

    // Determine routing batchId: prefer targetBatchId when available and not 'personal'
    const routingBatchId = (targetBatchId && targetBatchId !== 'personal') ? targetBatchId : batchId;

    // ── Route through DocumentIntelligenceRouter pipeline ──
    if (extractedText) {
      try {
        const routeResult = await routeDocument({
          text: extractedText,
          userId: req.user._id,
          batchId: routingBatchId,
          fileUrl,
          user: req.user,
        });

        // Determine if we should fall back to general Post creation:
        // 1. categories is ['general'] (classification fallback or all extractions/routing failed)
        // 2. routing.general has status 'fallback' (all routing failed in Step 6)
        // 3. ALL routing entries have status 'failed' (independent safety check)
        const categories = routeResult?.data?.categories || [];
        const isGeneralFallback = categories.length === 1 && categories[0] === 'general';
        const allRoutingFailed = routeResult?.data?.routing?.general?.status === 'fallback';

        // Independent check: if every routing entry has status 'failed', treat as all-failed
        const routingEntries = Object.values(routeResult?.data?.routing || {});
        const allEntriesFailed = routingEntries.length > 0 &&
          routingEntries.every((r) => r.status === 'failed');

        if (!isGeneralFallback && !allRoutingFailed && !allEntriesFailed) {
          // Return enhanced multi-category response from the router
          return ok(res, routeResult.data, 201);
        }
      } catch (routeErr) {
        console.error('[Upload] DocumentRouter failed, falling back to general pipeline:', routeErr.message);
        // Fall through to general Post creation below
      }
    }

    // ── General document fallback (existing pipeline) ──
    const extraction = await processUpload(fileUrl, batchId, req.user.uid, extractedText);

    const resolvedTargetType = targetType === 'personal' ? 'personal' : 'batch';
    const resolvedTargetBatchId = resolvedTargetType === 'batch' && targetBatchId ? targetBatchId : null;

    const post = await Post.create({
      batchId,
      uploadedBy: req.user._id,
      type: extraction.extractedType || 'general',
      title: extraction.title,
      originalText: '',
      fileUrl,
      summary: extraction.summary,
      actionRequired: extraction.actionRequired,
      category: extraction.category,
      priorityScore: extraction.priorityScore,
      priorityLevel: extraction.priorityLevel,
      verificationStatus: 'unverified',
      isDuplicate: false,
      targetType: resolvedTargetType,
      targetBatchId: resolvedTargetBatchId,
    });

    return ok(res, { post, extraction }, 201);
  } catch (err) {
    console.error('Upload file error:', err);
    return fail(res, err.message || 'Upload failed', 500);
  }
});

/**
 * POST /api/upload/text
 * Text input → DocumentClassifier → CourseFilter → DocumentIntelligenceRouter pipeline.
 * Multi-category classification routes text to appropriate modules.
 * Falls back to general Post creation for unclassified or "general" fallback documents.
 */
router.post('/text', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, text, targetType, targetBatchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);
    if (!text || !text.trim()) return fail(res, 'text is required', 400);

    // Determine routing batchId: prefer targetBatchId when available and not 'personal'
    const routingBatchId = (targetBatchId && targetBatchId !== 'personal') ? targetBatchId : batchId;

    // ── Route through DocumentIntelligenceRouter pipeline ──
    try {
      const routeResult = await routeDocument({
        text,
        userId: req.user._id,
        batchId: routingBatchId,
        fileUrl: '',
        user: req.user,
      });

      // Determine if we should fall back to general Post creation:
      // 1. categories is ['general'] (classification fallback or all extractions/routing failed)
      // 2. routing.general has status 'fallback' (all routing failed in Step 6)
      // 3. ALL routing entries have status 'failed' (independent safety check)
      const categories = routeResult?.data?.categories || [];
      const isGeneralFallback = categories.length === 1 && categories[0] === 'general';
      const allRoutingFailed = routeResult?.data?.routing?.general?.status === 'fallback';

      // Independent check: if every routing entry has status 'failed', treat as all-failed
      const routingEntries = Object.values(routeResult?.data?.routing || {});
      const allEntriesFailed = routingEntries.length > 0 &&
        routingEntries.every((r) => r.status === 'failed');

      if (!isGeneralFallback && !allRoutingFailed && !allEntriesFailed) {
        // Return enhanced multi-category response from the router
        return ok(res, routeResult.data, 201);
      }
    } catch (routeErr) {
      console.error('[Upload] DocumentRouter failed for text, falling back to general pipeline:', routeErr.message);
      // Fall through to general Post creation below
    }

    // ── General document fallback (existing pipeline) ──
    const extraction = await processUpload(null, batchId, req.user.uid, text);

    const resolvedTargetType = targetType === 'personal' ? 'personal' : 'batch';
    const resolvedTargetBatchId = resolvedTargetType === 'batch' && targetBatchId ? targetBatchId : null;

    const post = await Post.create({
      batchId,
      uploadedBy: req.user._id,
      type: extraction.extractedType || 'general',
      title: extraction.title,
      originalText: text,
      fileUrl: '',
      summary: extraction.summary,
      actionRequired: extraction.actionRequired,
      category: extraction.category,
      priorityScore: extraction.priorityScore,
      priorityLevel: extraction.priorityLevel,
      verificationStatus: 'unverified',
      isDuplicate: false,
      targetType: resolvedTargetType,
      targetBatchId: resolvedTargetBatchId,
    });

    return ok(res, { post, extraction }, 201);
  } catch (err) {
    console.error('Upload text error:', err);
    return fail(res, err.message || 'Upload failed', 500);
  }
});

export default router;
