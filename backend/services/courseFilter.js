/**
 * courseFilter.js
 *
 * Ensures only course-relevant data passes through to module creation.
 * Retrieves the uploading user's enrolled batches and their mapped courses,
 * then retains only information matching enrolled courses.
 */
import { BatchMember } from '../models/BatchMember.js';
import { Batch } from '../models/Batch.js';

/**
 * Filters extracted data to only include entries matching the user's enrolled courses.
 * Batch Admins (owner/moderator) bypass filtering for their target batch.
 * Entries without courseCode are passed through unfiltered.
 *
 * @param {string} userId - The uploading user's ID
 * @param {string} batchId - Target batch for the upload
 * @param {object} extractedData - Data extracted per category (keyed by category name, each value is an array of entries)
 * @returns {Promise<{ filtered: object, discardedCount: number }>}
 */
export async function filterByCourses(userId, batchId, extractedData) {
  console.log('[CourseFilter] Filtering extracted data for user:', userId, 'batch:', batchId);

  // Task 3.4: Check if user is a Batch Admin (owner/moderator) for the target batch
  const membership = await BatchMember.findOne({ userId, batchId }).lean();
  if (membership && (membership.role === 'owner' || membership.role === 'moderator')) {
    console.log('[CourseFilter] User is batch admin (role:', membership.role, ') — bypassing filter');
    return { filtered: extractedData, discardedCount: 0 };
  }

  // Task 3.5: Check if any entries have courseCode — if none do, skip filtering entirely
  const allEntries = collectAllEntries(extractedData);
  const hasAnyCourseCode = allEntries.some(entry => entry.courseCode);
  if (!hasAnyCourseCode) {
    console.log('[CourseFilter] No course codes found in extracted data — skipping filter');
    return { filtered: extractedData, discardedCount: 0 };
  }

  // Task 3.2: Build Set of enrolled course codes (uppercased)
  const enrolledCourses = await getEnrolledCourseSet(userId);
  console.log('[CourseFilter] Enrolled courses:', [...enrolledCourses]);

  // Task 3.3: Filter entries by enrolled courses
  let discardedCount = 0;
  const filtered = {};

  for (const [category, entries] of Object.entries(extractedData)) {
    if (!Array.isArray(entries)) {
      // Non-array values pass through unchanged
      filtered[category] = entries;
      continue;
    }

    const kept = [];
    for (const entry of entries) {
      // Entries without courseCode pass through (e.g., general notices)
      if (!entry.courseCode) {
        kept.push(entry);
        continue;
      }

      const normalizedCode = entry.courseCode.toUpperCase();
      if (enrolledCourses.has(normalizedCode)) {
        kept.push(entry);
      } else {
        discardedCount++;
      }
    }
    filtered[category] = kept;
  }

  console.log('[CourseFilter] Filtering complete. Kept entries across categories, discarded:', discardedCount);
  return { filtered, discardedCount };
}

/**
 * Retrieves all course codes the user is enrolled in across all their batches.
 *
 * 1. Query BatchMember.find({ userId }) → get all batchIds
 * 2. Query Batch.find({ _id: { $in: batchIds } }) → get each batch's courses[] array
 * 3. Build a Set of enrolled course codes (uppercased)
 *
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
async function getEnrolledCourseSet(userId) {
  // Step 1: Get all batch memberships for this user
  const memberships = await BatchMember.find({ userId }).lean();
  const batchIds = memberships.map(m => m.batchId);

  if (batchIds.length === 0) {
    console.log('[CourseFilter] User has no batch memberships');
    return new Set();
  }

  // Step 2: Get all batches and their courses
  const batches = await Batch.find({ _id: { $in: batchIds } }).lean();

  // Step 3: Build uppercased course code Set
  const courseSet = new Set();
  for (const batch of batches) {
    if (batch.courses && Array.isArray(batch.courses)) {
      for (const course of batch.courses) {
        if (course.code) {
          courseSet.add(course.code.toUpperCase());
        }
      }
    }
  }

  return courseSet;
}

/**
 * Collects all entry objects from the extractedData structure
 * to check if any have courseCode fields.
 *
 * @param {object} extractedData
 * @returns {Array}
 */
function collectAllEntries(extractedData) {
  const entries = [];
  for (const value of Object.values(extractedData)) {
    if (Array.isArray(value)) {
      entries.push(...value);
    }
  }
  return entries;
}
