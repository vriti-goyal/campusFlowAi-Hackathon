import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Post } from '../models/Post.js';
import { BatchMember } from '../models/BatchMember.js';

const router = express.Router();

router.use(verifyFirebaseToken);

// Middleware to check if user is a member of the batch
const checkBatchMembership = async (req, res, next) => {
  const batchId = req.params.batchId || req.body.batchId;
  if (!batchId) return res.status(400).json({ error: 'Batch ID is required' });

  const member = await BatchMember.findOne({ batchId, userId: req.user._id });
  if (!member) return res.status(403).json({ error: 'You are not a member of this batch' });
  
  req.batchMember = member; // attach for role checks
  next();
};

// GET /api/posts/:batchId
router.get('/:batchId', checkBatchMembership, async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = { batchId: req.params.batchId };
    
    if (category) query.type = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { originalText: { $regex: search, $options: 'i' } }
      ];
    }

    const posts = await Post.find(query).populate('uploadedBy', 'name email').sort({ isPinned: -1, createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/posts
router.post('/', async (req, res) => {
  try {
    const { batchId, type, title, originalText } = req.body;
    if (!batchId || !type || !title || !originalText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const member = await BatchMember.findOne({ batchId, userId: req.user._id });
    if (!member) return res.status(403).json({ error: 'You are not a member of this batch' });

    const post = await Post.create({
      batchId,
      uploadedBy: req.user._id,
      type,
      title,
      originalText,
      // Defaulting AI fields for simple text post until Person B completes their part
    });

    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Helper for fetching post and checking role
const getPostAndCheckRole = async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return null;
  }
  const member = await BatchMember.findOne({ batchId: post.batchId, userId: req.user._id });
  if (!member || (member.role !== 'owner' && member.role !== 'moderator')) {
    res.status(403).json({ error: 'Requires moderator or owner role' });
    return null;
  }
  return post;
};

// POST /api/posts/:postId/verify
router.post('/:postId/verify', async (req, res) => {
  try {
    const post = await getPostAndCheckRole(req, res);
    if (!post) return;

    post.verificationStatus = 'verified';
    post.verifiedBy = req.user._id;
    await post.save();
    
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify post' });
  }
});

// POST /api/posts/:postId/pin
router.post('/:postId/pin', async (req, res) => {
  try {
    const post = await getPostAndCheckRole(req, res);
    if (!post) return;

    post.isPinned = !post.isPinned;
    await post.save();
    
    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to pin post' });
  }
});

// DELETE /api/posts/:postId
router.delete('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const member = await BatchMember.findOne({ batchId: post.batchId, userId: req.user._id });
    const isUploader = post.uploadedBy.toString() === req.user._id.toString();
    const isMod = member && (member.role === 'owner' || member.role === 'moderator');

    if (!isUploader && !isMod) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
