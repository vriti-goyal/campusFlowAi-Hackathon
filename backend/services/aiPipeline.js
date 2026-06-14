import { extractTextFromFile } from '../config/textract.js';
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
    console.warn('[AI Pipeline] JSON parse failed, attempting regex fallback:', e.message);
    return regexFallbackExtraction(fallbackText || raw);
  }
}

/**
 * Basic regex fallback if Bedrock returns unparseable output.
 * Extracts dates and keywords to build a minimal extraction.
 */
function regexFallbackExtraction(text) {
  // Try to find dates in common formats
  const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
  const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  let deadline = null;
  if (isoDateMatch) {
    deadline = new Date(isoDateMatch[1]).toISOString();
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
async function checkDuplicate(batchId, category, title) {
  if (!title) return null;

  const normalizedTitle = title.toLowerCase().trim();

  // Look for posts in same batch with same category
  const candidates = await Post.find({ batchId, category }).select('title').lean();

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
 * 1. Extract text (Textract for files, raw text for text input)
 * 2. Call Bedrock for notice extraction
 * 3. If placement, call Bedrock again for structured placement fields
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
  let extractedText;

  // Step 1: Get text
  if (fileUrl) {
    console.log('[AI Pipeline] Extracting text from file via Textract...');
    try {
      extractedText = await extractTextFromFile(fileUrl);
      console.log('[AI Pipeline] Textract result length:', extractedText.length);
    } catch (err) {
      console.error('[AI Pipeline] Textract failed:', err.message);
      throw new Error(`Text extraction failed: ${err.message}`);
    }
  } else if (rawText) {
    extractedText = rawText;
  } else {
    throw new Error('No file URL or text provided');
  }

  if (!extractedText || !extractedText.trim()) {
    throw new Error('No text could be extracted from the document');
  }

  // Step 2: Notice extraction via Bedrock
  console.log('[AI Pipeline] Calling Bedrock for notice extraction...');
  let extraction;
  try {
    const noticePrompt = buildNoticeExtractionPrompt(extractedText);
    const noticeResponse = await invokeAI(noticePrompt, 1024);
    extraction = parseLLMResponse(noticeResponse, extractedText);
    console.log('[AI Pipeline] Notice extraction result:', JSON.stringify(extraction));
  } catch (err) {
    console.error('[AI Pipeline] Bedrock notice extraction failed:', err.message);
    // Fallback to regex
    extraction = regexFallbackExtraction(extractedText);
    console.log('[AI Pipeline] Using regex fallback:', JSON.stringify(extraction));
  }

  // Step 3: If placement, get structured placement fields
  if (extraction.category === 'placement') {
    console.log('[AI Pipeline] Calling Bedrock for placement-specific extraction...');
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
      console.error('[AI Pipeline] Bedrock placement extraction failed:', err.message);
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
  const duplicate = await checkDuplicate(batchId, extraction.category, extraction.title);
  if (duplicate) {
    console.log('[AI Pipeline] Duplicate detected, postId:', duplicate._id);
    extraction.isDuplicate = true;
    extraction.duplicatePostId = duplicate._id;
  } else {
    extraction.isDuplicate = false;
  }

  return extraction;
}
