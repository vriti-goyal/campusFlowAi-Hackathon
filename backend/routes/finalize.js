import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Post } from '../models/Post.js';
import { Assignment } from '../models/Assignment.js';
import { Exam } from '../models/Exam.js';
import { Placement } from '../models/Placement.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { calculatePriorityScore } from '../services/priorityScore.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * POST /api/upload/finalize
 * After user reviews AI extraction and confirms, create the appropriate
 * domain entry (Assignment / Exam / Placement) based on category.
 *
 * Body: { postId, extraction } — extraction may have been edited by user
 */
router.post('/finalize', verifyFirebaseToken, async (req, res) => {
  try {
    const { postId, extraction } = req.body;
    if (!postId || !extraction) return fail(res, 'postId and extraction are required', 400);

    const post = await Post.findById(postId);
    if (!post) return fail(res, 'Post not found', 404);

    // Mark post as verified
    post.verificationStatus = 'verified';
    post.title = extraction.title || post.title;
    post.summary = extraction.summary || post.summary;
    post.category = extraction.category || post.category;
    await post.save();

    const { category } = extraction;
    let entry;

    if (category === 'assignment') {
      const { priorityScore, priorityLevel } = calculatePriorityScore({
        deadline: extraction.deadline,
        category: 'assignment',
        verified: true,
      });
      entry = await Assignment.create({
        batchId: post.batchId,
        postId: post._id,
        title: extraction.title,
        subject: extraction.subject || '',
        deadline: extraction.deadline || null,
        submissionMode: extraction.submissionMode || 'online',
        priorityScore,
        priorityLevel,
        status: 'Not Started',
        actionRequired: extraction.actionRequired || '',
      });

      if (extraction.deadline) {
        await CalendarEvent.create({
          userId: req.user.uid,
          batchId: post.batchId,
          title: `Assignment: ${extraction.title}`,
          category: 'assignment',
          date: new Date(extraction.deadline),
          sourceType: 'assignment',
          sourceId: entry._id,
          status: 'upcoming',
        });
      }
    } else if (category === 'exam') {
      entry = await Exam.create({
        batchId: post.batchId,
        postId: post._id,
        subject: extraction.title || extraction.subject || 'Untitled Exam',
        date: extraction.deadline ? new Date(extraction.deadline) : new Date(),
        time: extraction.time || '',
        venue: extraction.venue || '',
        priorityLevel: extraction.priorityLevel || 'high',
      });

      await CalendarEvent.create({
        userId: req.user.uid,
        batchId: post.batchId,
        title: `Exam: ${entry.subject}`,
        category: 'exam',
        date: entry.date,
        time: entry.time,
        sourceType: 'exam',
        sourceId: entry._id,
        status: 'upcoming',
      });
    } else if (category === 'placement') {
      const { priorityScore } = calculatePriorityScore({
        deadline: extraction.deadline,
        category: 'placement',
        verified: true,
      });
      entry = await Placement.create({
        batchId: post.batchId,
        postId: post._id,
        company: extraction.company || extraction.title || 'Unknown',
        role: extraction.role || '',
        package: extraction.package || '',
        eligibleBranches: extraction.eligibleBranches || [],
        minimumCgpa: extraction.minimumCgpa || 0,
        allowedBacklogs: extraction.allowedBacklogs || 0,
        deadline: extraction.deadline ? new Date(extraction.deadline) : null,
        testDate: extraction.testDate ? new Date(extraction.testDate) : null,
        applicationLink: extraction.applicationLink || '',
        priorityScore,
        status: 'active',
      });

      if (extraction.deadline) {
        await CalendarEvent.create({
          userId: req.user.uid,
          batchId: post.batchId,
          title: `Placement: ${entry.company} - ${entry.role || 'Apply'}`,
          category: 'placement',
          date: new Date(extraction.deadline),
          sourceType: 'placement',
          sourceId: entry._id,
          status: 'upcoming',
        });
      }
    } else {
      // General — no specific model, post is enough
      entry = post;
    }

    return ok(res, { post, entry, category });
  } catch (err) {
    console.error('Finalize error:', err);
    return fail(res, err.message, 500);
  }
});

export default router;
