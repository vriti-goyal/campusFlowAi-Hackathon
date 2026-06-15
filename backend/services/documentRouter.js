import { invokeAI } from '../config/gemini.js';
import { detectDocumentType, extractAssignmentFromText, extractPlacementFromText } from './documentExtractor.js';
import { Assignment } from '../models/Assignment.js';
import { Placement } from '../models/Placement.js';
import { StudentPlacementStatus } from '../models/StudentPlacementStatus.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { Post } from '../models/Post.js';
import { BatchMember } from '../models/BatchMember.js';
import { User } from '../models/User.js';
import { calculatePriorityScore } from './priorityScore.js';

/**
 * Main document routing pipeline.
 * Called from upload.js for both file and text uploads.
 * Routes to Assignment, Placement, or falls back to general Post.
 */
export async function routeDocument({ text, userId, batchId, fileUrl, user, targetType, targetBatchId }) {
  try {
    // Step 1: Classify document type
    const docType = detectDocumentType(text);
    console.log(`[Router] Detected type: ${docType} for batchId: ${batchId}`);

    // Step 2: Route based on type
    switch (docType) {
      case 'assignment':
        return await handleAssignment({ text, userId, batchId, fileUrl, targetType, targetBatchId });

      case 'placement':
        return await handlePlacement({ text, userId, batchId, fileUrl, user, targetType, targetBatchId });

      case 'general':
      default:
        // Return general fallback — upload.js will create a Post
        return {
          data: {
            categories: ['general'],
            routing: { general: { status: 'fallback' } }
          }
        };
    }

  } catch (err) {
    console.error('[Router] Fatal error:', err.message);
    return {
      data: {
        categories: ['general'],
        routing: { general: { status: 'fallback' } }
      }
    };
  }
}

// ── Assignment Handler ───────────────────────────────────────────────

async function handleAssignment({ text, userId, batchId, fileUrl, targetType, targetBatchId }) {
  console.log('[Router] Handling as assignment');

  const extracted = await extractAssignmentFromText(text);

  if (!extracted || !extracted.title) {
    console.warn('[Router] Assignment extraction returned empty result');
    return {
      data: {
        categories: ['general'],
        routing: { general: { status: 'fallback' } }
      }
    };
  }

  const { priorityScore, priorityLevel } = calculatePriorityScore({
    deadline: extracted.deadline,
    category: 'assignment',
    verified: false,
  });

  // Create Post
  const post = await Post.create({
    batchId,
    uploadedBy: userId,
    type: 'assignment',
    title: extracted.title,
    originalText: text.slice(0, 500),
    fileUrl: fileUrl || '',
    summary: extracted.description || extracted.title,
    actionRequired: extracted.action_required || `Submit ${extracted.title}`,
    category: 'assignment',
    priorityScore,
    priorityLevel,
    verificationStatus: 'unverified',
    isDuplicate: false,
    targetType: targetType || 'batch',
    targetBatchId: targetBatchId || null,
  });

  // Create Assignment
  const assignment = await Assignment.create({
    userId,
    batchId,
    postId: post._id,
    title: extracted.title,
    subject: extracted.subject || '',
    deadline: extracted.deadline ? new Date(extracted.deadline) : null,
    submissionMode: extracted.submission_mode || '',
    priorityScore,
    priorityLevel,
    status: 'Not Started',
    actionRequired: extracted.action_required || `Submit ${extracted.title}`,
  });

  // Create Calendar Event if deadline exists
  if (extracted.deadline) {
    await CalendarEvent.create({
      userId,
      batchId,
      title: `📝 ${extracted.title} Due`,
      category: 'Assignment',
      date: new Date(extracted.deadline).toISOString().split('T')[0],
      time: new Date(extracted.deadline).toTimeString().slice(0, 5),
      sourceType: 'assignment',
      sourceId: assignment._id,
      status: 'Active',
    });
  }

  console.log(`[Router] Assignment created: ${assignment._id}`);

  return {
    data: {
      categories: ['assignment'],
      routing: {
        assignment: {
          status: 'success',
          assignmentId: assignment._id,
          postId: post._id,
          title: extracted.title,
          subject: extracted.subject,
          deadline: extracted.deadline,
          submissionMode: extracted.submission_mode,
          actionRequired: extracted.action_required,
          priorityLevel,
        }
      },
      message: `✅ Assignment detected! "${extracted.title}" added to your Assignment Hub.`,
      autoDetected: 'assignment',
    }
  };
}

// ── Placement Handler ────────────────────────────────────────────────

async function handlePlacement({ text, userId, batchId, fileUrl, user, targetType, targetBatchId }) {
  console.log('[Router] Handling as placement');

  const extracted = await extractPlacementFromText(text);

  if (!extracted || !extracted.company) {
    console.warn('[Router] Placement extraction returned empty result');
    return {
      data: {
        categories: ['general'],
        routing: { general: { status: 'fallback' } }
      }
    };
  }

  const { priorityScore, priorityLevel } = calculatePriorityScore({
    deadline: extracted.deadline,
    category: 'placement',
    verified: false,
  });

  // Create Post
  const post = await Post.create({
    batchId,
    uploadedBy: userId,
    type: 'placement',
    title: `${extracted.company} — ${extracted.role || 'Hiring Drive'}`,
    originalText: text.slice(0, 500),
    fileUrl: fileUrl || '',
    summary: `${extracted.company} is hiring ${extracted.role || 'candidates'}. Package: ${extracted.package || 'TBD'}`,
    actionRequired: extracted.action_required || 'Register before the deadline',
    category: 'placement',
    priorityScore,
    priorityLevel,
    verificationStatus: 'unverified',
    isDuplicate: false,
    targetType: targetType || 'batch',
    targetBatchId: targetBatchId || null,
  });

  // Create Placement
  const placement = await Placement.create({
    batchId,
    postId: post._id,
    company: extracted.company,
    role: extracted.role || '',
    package: extracted.package || '',
    eligibleBranches: extracted.eligible_branches || [],
    minimumCgpa: extracted.minimum_cgpa || 0,
    allowedBacklogs: extracted.allowed_backlogs || 0,
    deadline: extracted.deadline ? new Date(extracted.deadline) : null,
    testDate: extracted.test_date ? new Date(extracted.test_date) : null,
    applicationLink: extracted.application_link || '',
    priorityScore,
    status: 'Open',
    source: 'upload',
  });

  // Create Calendar Event for deadline
  if (extracted.deadline) {
    await CalendarEvent.create({
      userId,
      batchId,
      title: `🏢 ${extracted.company} Registration Deadline`,
      category: 'Placement',
      date: new Date(extracted.deadline).toISOString().split('T')[0],
      time: new Date(extracted.deadline).toTimeString().slice(0, 5),
      sourceType: 'placement',
      sourceId: placement._id,
      status: 'Active',
    });
  }

  // Create StudentPlacementStatus for uploader
  try {
    const userDoc = await User.findById(userId);
    if (userDoc) {
      const isEligibleBranch =
        !extracted.eligible_branches?.length ||
        extracted.eligible_branches.some(b =>
          b.toLowerCase() === userDoc.branch?.toLowerCase()
        );
      const isEligibleCgpa =
        !extracted.minimum_cgpa ||
        (userDoc.cgpa >= extracted.minimum_cgpa);

      const eligibilityStatus = (isEligibleBranch && isEligibleCgpa)
        ? 'Eligible' : 'Not Eligible';

      await StudentPlacementStatus.findOneAndUpdate(
        { studentId: userId, placementId: placement._id },
        { eligibilityStatus, applicationStatus: 'Not Applied' },
        { upsert: true, new: true }
      );
    }
  } catch (e) {
    console.warn('[Router] Could not create StudentPlacementStatus:', e.message);
  }

  console.log(`[Router] Placement created: ${placement._id}`);

  return {
    data: {
      categories: ['placement'],
      routing: {
        placement: {
          status: 'success',
          placementId: placement._id,
          postId: post._id,
          company: extracted.company,
          role: extracted.role,
          package: extracted.package,
          deadline: extracted.deadline,
          priorityLevel,
        }
      },
      message: `🏢 Placement opportunity detected! ${extracted.company} added to your Placement Hub.`,
      autoDetected: 'placement',
    }
  };
}
