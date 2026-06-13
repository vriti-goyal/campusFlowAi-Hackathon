import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { uploadToS3 } from '../config/s3.js';
import { processUpload } from '../services/aiPipeline.js';
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
 * Multipart file upload → S3 → AI pipeline stub → create Post
 */
router.post('/file', verifyFirebaseToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file provided', 400);

    const { batchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);

    // Upload to S3
    const fileUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);

    // Run AI pipeline stub
    const extraction = await processUpload(fileUrl, batchId, req.user.uid);

    // Create Post document
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
    });

    return ok(res, { post, extraction }, 201);
  } catch (err) {
    console.error('Upload file error:', err);
    return fail(res, err.message || 'Upload failed', 500);
  }
});

/**
 * POST /api/upload/text
 * Text input → AI pipeline stub → create Post
 */
router.post('/text', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, text } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);
    if (!text || !text.trim()) return fail(res, 'text is required', 400);

    // Run AI pipeline stub (no file, pass text)
    const extraction = await processUpload(null, batchId, req.user.uid, text);

    // Create Post document
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
    });

    return ok(res, { post, extraction }, 201);
  } catch (err) {
    console.error('Upload text error:', err);
    return fail(res, err.message || 'Upload failed', 500);
  }
});

export default router;
