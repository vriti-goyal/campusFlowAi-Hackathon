import { invokeAI } from '../config/gemini.js';
import { calculatePriorityScore } from './priorityScore.js';
import { Post } from '../models/Post.js';

// ── Prompts ─────────────────────────────────────────────────

function buildNoticeExtractionPrompt(text) {
  return `You are an AI assistant for a college campus management system called CampusFlow AI.

Analyze the following notice/document text and extract structured information.

TEXT:
"""
${text}
"""

Return ONLY valid JSON, no markdown formatting, no explanation. Use this exact schema:
{
  "category": "assignment" | "exam" | "placement" | "general",
  "title": "short descriptive title",
  "summary": "2-3 sentence summary of the notice",
  "actionRequired": "what the student needs to do",
  "deadline": "ISO 8601 date string or null if not mentioned",
  "subject": "subject/course name if applicable or empty string",
  "venue": "location if mentioned or empty string",
  "time": "time if mentioned or empty string"
}

Rules:
- "category" must be exactly one of: assignment, exam, placement, general
- If a deadline/date is mentioned, convert to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- If no clear deadline, set to null
- Be concise in summary and actionRequired`;
}

function buildPlacementExtractionPrompt(text) {
  return `You are an AI assistant for a college campus management system.

The following text is a PLACEMENT notice. Extract structured placement details.

TEXT:
"""
${text}
"""

Return ONLY valid JSON, no markdown formatting, no explanation. Use this exact schema:
{
  "company": "company name",
  "role": "job role/position",
  "package": "salary/stipend information as string",
  "eligibleBranches": ["CSE", "IT", "ECE"],
  "minimumCgpa": 0.0,
  "allowedBacklogs": 0,
  "deadline": "ISO 8601 date or null",
  "testDate": "ISO 8601 date or null",
  "applicationLink": "URL if mentioned or empty string"
}

Rules:
- eligibleBranches should be an array of branch abbreviations
- minimumCgpa should be a number (e.g., 7.5)
- allowedBacklogs should be an integer
- If information is not mentioned, use reasonable defaults (empty string, 0, null, empty array)`;
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Strip markdown fences and parse JSON from LLM output.
 * Falls back to regex-based extraction if JSON parse fails.
 */
function parseLLMResponse(raw, fallbackText) {
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const objectCandidate = extractFirstJsonObject(cleaned);
    if (objectCandidate) {
      try {
        return JSON.parse(objectCandidate);
      } catch {
        // continue to regex fallback below
      }
    }
    console.warn('[AI Pipeline] JSON parse failed, attempting regex fallback:', e.message);
    return regexFallbackExtraction(fallbackText || raw);
  }
}

function extractFirstJsonObject(raw) {
  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Basic regex fallback if model output is unparseable.
 * Extracts dates and keywords to build a minimal extraction.
 */
function regexFallbackExtraction(text) {
  // Try to find dates in common formats
  const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
  const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  const longMonthDateMatch = text.match(/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/);
  let deadline = null;
  if (isoDateMatch) {
    deadline = new Date(isoDateMatch[1]).toISOString();
  } else if (longMonthDateMatch) {
    const parsed = new Date(longMonthDateMatch[1]);
    if (!isNaN(parsed)) deadline = parsed.toISOString();
  } else if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed)) deadline = parsed.toISOString();
  }

  // Determine category from keywords
  let category = 'general';
  const lower = text.toLowerCase();
  if (lower.includes('placement') || lower.includes('hiring') || lower.includes('recruit') || lower.includes('package') || lower.includes('ctc')) {
    category = 'placement';
  } else if (lower.includes('exam') || lower.includes('test') || lower.includes('midterm') || lower.includes('end-term')) {
    category = 'exam';
  } else if (lower.includes('assignment') || lower.includes('submit') || lower.includes('homework') || lower.includes('deadline')) {
    category = 'assignment';
  }

  // Extract a title (first line or first 60 chars)
  const firstLine = text.split('\n')[0]?.trim() || '';
  const title = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine || 'Untitled Notice';

  return {
    category,
    title,
    summary: text.slice(0, 200).trim(),
    actionRequired: 'Please review the original notice for required actions.',
    deadline,
    subject: '',
    venue: '',
    time: '',
  };
}

/**
 * Simple duplicate check: compare lowercase trimmed titles within same batch + category.
 * Returns existing Post if duplicate found, null otherwise.
 */
async function checkDuplicate(batchId, uploadedBy, category, title) {
  if (!title) return null;

  const normalizedTitle = title.toLowerCase().trim();

  // Look for posts in same batch with same category
  const query = { category };
  if (batchId) {
    query.batchId = batchId;
  } else {
    query.batchId = null;
    query.uploadedBy = uploadedBy;
  }

  const candidates = await Post.find(query).select('title').lean();

  for (const post of candidates) {
    const existingTitle = (post.title || '').toLowerCase().trim();
    // Exact match or one is substring of the other
    if (
      existingTitle === normalizedTitle ||
      (existingTitle.length > 10 && normalizedTitle.includes(existingTitle)) ||
      (normalizedTitle.length > 10 && existingTitle.includes(normalizedTitle))
    ) {
      return post;
    }
  }

  return null;
}

// ── Main Pipeline ───────────────────────────────────────────

/**
 * Process an upload through the real AI pipeline:
 * 1. Extract text (file OCR/parser or raw text input)
 * 2. Call AI model for notice extraction
 * 3. If placement, call AI model again for structured placement fields
 * 4. Calculate priority score
 * 5. Check for duplicates
 *
 * @param {string|null} fileUrl - S3 URL if file uploaded
 * @param {string} batchId
 * @param {string} uploadedBy - Firebase UID
 * @param {string|null} rawText - Raw text if text input
 * @returns {object} extraction result
 */
export async function processUpload(fileUrl, batchId, uploadedBy, rawText = null) {
  let extractedText = rawText;

  if (!extractedText || !extractedText.trim()) {
    extractedText = `Document uploaded: ${fileUrl || 'unknown file'}. Please classify this as a general academic notice.`;
  }

  // Step 2: Notice extraction via AI model
  console.log('[AI Pipeline] Calling AI model for notice extraction...');
  let extraction;
  try {
    const noticePrompt = buildNoticeExtractionPrompt(extractedText);
    const noticeResponse = await invokeAI(noticePrompt, 1024);
    extraction = parseLLMResponse(noticeResponse, extractedText);
    console.log('[AI Pipeline] Notice extraction result:', JSON.stringify(extraction));
  } catch (err) {
    console.error('[AI Pipeline] Notice extraction failed:', err.message);
    // Fallback to regex
    extraction = regexFallbackExtraction(extractedText);
    console.log('[AI Pipeline] Using regex fallback:', JSON.stringify(extraction));
  }

  // Step 3: If placement, get structured placement fields
  if (extraction.category === 'placement') {
    console.log('[AI Pipeline] Calling AI model for placement-specific extraction...');
    try {
      const placementPrompt = buildPlacementExtractionPrompt(extractedText);
      const placementResponse = await invokeAI(placementPrompt, 1024);
      const placementFields = parseLLMResponse(placementResponse, extractedText);
      // Merge placement fields into extraction
      Object.assign(extraction, {
        company: placementFields.company || extraction.title || 'Unknown',
        role: placementFields.role || '',
        package: placementFields.package || '',
        eligibleBranches: placementFields.eligibleBranches || [],
        minimumCgpa: placementFields.minimumCgpa || 0,
        allowedBacklogs: placementFields.allowedBacklogs || 0,
        testDate: placementFields.testDate || null,
        applicationLink: placementFields.applicationLink || '',
        // Use placement-specific deadline if available
        deadline: placementFields.deadline || extraction.deadline,
      });
      console.log('[AI Pipeline] Placement fields merged');
    } catch (err) {
      console.error('[AI Pipeline] Placement extraction failed:', err.message);
      // Continue with basic extraction — no placement-specific fields
      extraction.company = extraction.title || 'Unknown';
      extraction.role = '';
      extraction.package = '';
      extraction.eligibleBranches = [];
      extraction.minimumCgpa = 0;
      extraction.allowedBacklogs = 0;
      extraction.testDate = null;
      extraction.applicationLink = '';
    }
  }

  // Step 4: Calculate priority score
  const { priorityScore, priorityLevel } = calculatePriorityScore({
    deadline: extraction.deadline,
    category: extraction.category,
    verified: false,
  });
  extraction.priorityScore = priorityScore;
  extraction.priorityLevel = priorityLevel;
  extraction.extractedType = extraction.category;

  // Step 5: Duplicate check
  const duplicate = await checkDuplicate(batchId, uploadedBy, extraction.category, extraction.title);
  if (duplicate) {
    console.log('[AI Pipeline] Duplicate detected, postId:', duplicate._id);
    extraction.isDuplicate = true;
    extraction.duplicatePostId = duplicate._id;
  } else {
    extraction.isDuplicate = false;
  }

  return extraction;
}
