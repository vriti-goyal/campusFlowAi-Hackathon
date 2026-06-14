/**
 * documentClassifier.js
 *
 * AI-powered multi-category document classifier.
 * Analyzes OCR-extracted text and returns one or more category labels
 * with confidence scores using Gemini AI.
 */
import { invokeAI } from '../config/gemini.js';
import { detectDocumentType } from './documentExtractor.js';

// ── Helpers ─────────────────────────────────────────────────

function parseLLMJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    console.error('[DocumentClassifier] JSON parse failed:', e.message, 'Raw (first 500):', raw.slice(0, 500));
    return null;
  }
}

// ── Classification Prompt ───────────────────────────────────

const CLASSIFICATION_PROMPT = (text) => `You are an AI classifier for a college campus management system.

Analyze the following document text and determine which categories it belongs to.
A document can belong to MULTIPLE categories simultaneously.

TEXT:
"""
${text.slice(0, 6000)}
"""

Return ONLY valid JSON with this schema:
{
  "categories": {
    "timetable": <confidence 0.0 to 1.0>,
    "exam_schedule": <confidence 0.0 to 1.0>,
    "assignment": <confidence 0.0 to 1.0>,
    "notice": <confidence 0.0 to 1.0>
  },
  "reasoning": "brief explanation of classification"
}

Classification rules:
- "timetable": Weekly class schedules with days, times, courses, rooms
- "exam_schedule": Exam dates, times, venues for Mid/End Sem, Quiz, Practical, Viva
- "assignment": Homework, projects, submissions with questions or tasks to complete
- "notice": Administrative announcements about cancellations, reschedules, room/faculty changes, deadlines
- A document can be BOTH an exam_schedule AND a notice (e.g., revised exam dates)
- A document can be BOTH a timetable AND a notice (e.g., updated class schedule)
- Set confidence to 0.0 if no evidence for that category`;

// ── Confidence Threshold ────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.6;

// ── Main Classification Function ────────────────────────────

/**
 * Classify document text into one or more categories using AI.
 * Falls back to keyword heuristics on failure.
 *
 * @param {string} text - OCR-extracted text
 * @returns {Promise<{ categories: string[], confidence: object }>}
 */
export async function classifyDocument(text) {
  console.log('[DocumentClassifier] Classifying document, text length:', text.length);

  let lastError = null;

  // Attempt AI classification with one retry
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await invokeAI(CLASSIFICATION_PROMPT(text), 512);
      const parsed = parseLLMJSON(response);

      if (!parsed || !parsed.categories) {
        throw new Error('Invalid AI response: missing categories object');
      }

      const confidence = parsed.categories;
      const validCategories = ['timetable', 'exam_schedule', 'assignment', 'notice'];

      // Filter to categories meeting the confidence threshold
      const categories = validCategories.filter(
        (cat) => typeof confidence[cat] === 'number' && confidence[cat] >= CONFIDENCE_THRESHOLD
      );

      // If no category meets threshold, fallback to "general"
      if (categories.length === 0) {
        console.log('[DocumentClassifier] No category met threshold, returning general');
        return { categories: ['general'], confidence };
      }

      console.log('[DocumentClassifier] Classification result:', categories, confidence);
      return { categories, confidence };
    } catch (err) {
      lastError = err;
      console.error(`[DocumentClassifier] AI attempt ${attempt} failed:`, err.message);

      // Wait 3 seconds before retry (only on first failure)
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  // Both attempts failed — fallback to keyword heuristic
  console.warn('[DocumentClassifier] AI classification failed, falling back to heuristic. Error:', lastError?.message);
  return fallbackClassification(text);
}

// ── Fallback Heuristic ──────────────────────────────────────

/**
 * Uses the existing detectDocumentType() keyword heuristic as fallback.
 * Maps its single-category result into the multi-category response shape.
 *
 * @param {string} text
 * @returns {{ categories: string[], confidence: object }}
 */
function fallbackClassification(text) {
  const type = detectDocumentType(text);

  const confidence = {
    timetable: 0,
    exam_schedule: 0,
    assignment: 0,
    notice: 0,
  };

  if (type === 'general') {
    return { categories: ['general'], confidence };
  }

  // Set matched category to 1.0 confidence for heuristic match
  confidence[type] = 1.0;
  return { categories: [type], confidence };
}
