import { invokeAI } from '../config/gemini.js';

/**
 * PLACEMENT_KEYWORDS — used to filter relevant emails from inbox.
 */
export const PLACEMENT_KEYWORDS = [
  'placement', 'recruitment', 'drive', 'hiring', 'offer',
  'ctc', 'stipend', 'internship', 'ppo', 'job opening',
  'campus recruitment', 'selection process', 'aptitude test',
  'technical interview', 'hr round',
];

/**
 * Check if an email body/subject contains any placement keyword.
 * @param {string} subject
 * @param {string} body
 * @returns {boolean}
 */
export function isPlacementEmail(subject = '', body = '') {
  const combined = `${subject} ${body}`.toLowerCase();
  return PLACEMENT_KEYWORDS.some((kw) => combined.includes(kw));
}

/**
 * Parse a raw email body using the Bedrock AI model to extract
 * structured placement notice fields.
 *
 * @param {string} rawBody — the raw email body text
 * @returns {Promise<object|null>} — parsed fields object, or null on failure
 */
export async function parseEmailWithAI(rawBody) {
  const systemPrompt = `You are a placement notice parser. Extract the following fields from the email body and return ONLY a valid JSON object with no extra text:
{
  "companyName": string or null,
  "roleTitle": string or null,
  "ctc": string or null,
  "stipend": string or null,
  "eligibilityCriteria": {
    "minCGPA": number or null,
    "maxBacklogs": number or null,
    "branches": array of strings,
    "graduationYears": array of numbers,
    "otherConstraints": array of strings
  },
  "applicationDeadline": ISO date string or null,
  "assessmentDate": ISO date string or null,
  "interviewDate": ISO date string or null,
  "jobLocation": string or null,
  "requiredSkills": array of strings
}
If a field is not found, set it to null or an empty array. Do not guess.

Email body:
${rawBody.slice(0, 4000)}`; // Truncate to avoid token limits

  try {
    const rawOutput = await invokeAI(systemPrompt, 600);

    // Strip markdown code fences if the model adds them
    const cleaned = rawOutput
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Find the first { ... } block
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[PlacementParser] No JSON object found in AI output:', cleaned.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalise date strings to Date objects (stored as ISO strings in DB)
    const dateFields = ['applicationDeadline', 'assessmentDate', 'interviewDate'];
    for (const field of dateFields) {
      if (parsed[field]) {
        const d = new Date(parsed[field]);
        parsed[field] = isNaN(d.getTime()) ? null : d.toISOString();
      }
    }

    // Ensure array fields are actually arrays
    const arrayFields = ['branches', 'graduationYears', 'otherConstraints', 'requiredSkills'];
    for (const field of arrayFields) {
      if (field === 'requiredSkills') {
        if (!Array.isArray(parsed[field])) parsed[field] = [];
      } else if (parsed.eligibilityCriteria) {
        if (!Array.isArray(parsed.eligibilityCriteria[field])) {
          parsed.eligibilityCriteria[field] = [];
        }
      }
    }

    return parsed;
  } catch (err) {
    console.error('[PlacementParser] AI parse error:', err.message);
    return null;
  }
}

/**
 * Compare a student's profile against parsed placement eligibility criteria.
 *
 * @param {object} parsed — the parsed field from PlacementNotice
 * @param {object} user — the User document
 * @returns {{ status: 'eligible'|'not_eligible'|'partial', breakdown: object }}
 */
export function checkEligibility(parsed, user) {
  if (!parsed || !parsed.eligibilityCriteria) {
    return { status: 'partial', breakdown: { reason: 'No criteria parsed' } };
  }

  const criteria = parsed.eligibilityCriteria;
  const breakdown = {};
  let allPass = true;
  let hasFail = false;
  let hasUnknown = false;

  // ── CGPA check ──────────────────────────────────────────────
  if (criteria.minCGPA !== null && criteria.minCGPA !== undefined) {
    if (user.cgpa === null || user.cgpa === undefined) {
      breakdown.cgpa = { status: 'unknown', required: criteria.minCGPA, actual: null };
      hasUnknown = true;
    } else if (user.cgpa >= criteria.minCGPA) {
      breakdown.cgpa = { status: 'pass', required: criteria.minCGPA, actual: user.cgpa };
    } else {
      breakdown.cgpa = { status: 'fail', required: criteria.minCGPA, actual: user.cgpa };
      hasFail = true;
      allPass = false;
    }
  } else {
    breakdown.cgpa = { status: 'not_required' };
  }

  // ── Backlog check ────────────────────────────────────────────
  if (criteria.maxBacklogs !== null && criteria.maxBacklogs !== undefined) {
    const userBacklogs = user.backlogs ?? null;
    if (userBacklogs === null) {
      breakdown.backlogs = { status: 'unknown', maxAllowed: criteria.maxBacklogs, actual: null };
      hasUnknown = true;
    } else if (userBacklogs <= criteria.maxBacklogs) {
      breakdown.backlogs = { status: 'pass', maxAllowed: criteria.maxBacklogs, actual: userBacklogs };
    } else {
      breakdown.backlogs = { status: 'fail', maxAllowed: criteria.maxBacklogs, actual: userBacklogs };
      hasFail = true;
      allPass = false;
    }
  } else {
    breakdown.backlogs = { status: 'not_required' };
  }

  // ── Branch check ─────────────────────────────────────────────
  if (criteria.branches && criteria.branches.length > 0) {
    if (!user.branch) {
      breakdown.branch = { status: 'unknown', allowed: criteria.branches, actual: null };
      hasUnknown = true;
    } else {
      const branchMatch = criteria.branches.some(
        (b) => b.toLowerCase() === user.branch.toLowerCase()
      );
      if (branchMatch) {
        breakdown.branch = { status: 'pass', allowed: criteria.branches, actual: user.branch };
      } else {
        breakdown.branch = { status: 'fail', allowed: criteria.branches, actual: user.branch };
        hasFail = true;
        allPass = false;
      }
    }
  } else {
    breakdown.branch = { status: 'not_required' };
  }

  // ── Graduation Year check ────────────────────────────────────
  if (criteria.graduationYears && criteria.graduationYears.length > 0) {
    if (!user.graduationYear) {
      breakdown.graduationYear = { status: 'unknown', allowed: criteria.graduationYears, actual: null };
      hasUnknown = true;
    } else {
      const yearMatch = criteria.graduationYears.includes(user.graduationYear);
      if (yearMatch) {
        breakdown.graduationYear = { status: 'pass', allowed: criteria.graduationYears, actual: user.graduationYear };
      } else {
        breakdown.graduationYear = { status: 'fail', allowed: criteria.graduationYears, actual: user.graduationYear };
        hasFail = true;
        allPass = false;
      }
    }
  } else {
    breakdown.graduationYear = { status: 'not_required' };
  }

  // ── Final determination ──────────────────────────────────────
  let status;
  if (hasFail) {
    status = 'not_eligible';
  } else if (hasUnknown && !hasFail) {
    status = 'partial'; // Some criteria could not be evaluated
  } else {
    status = 'eligible';
  }

  return { status, breakdown };
}

/**
 * Generate a JD-based preparation plan using the AI model.
 * Returns a structured plan object, or null on failure.
 *
 * @param {string} roleTitle
 * @param {string[]} requiredSkills
 * @returns {Promise<object|null>}
 */
export async function generatePrepPlan(roleTitle, requiredSkills = []) {
  const skillsList = requiredSkills.length > 0 ? requiredSkills.join(', ') : 'General';

  const prompt = `You are a campus placement preparation assistant for engineering students in India.
Given the following job role and required skills, generate a structured preparation plan.
Role: ${roleTitle || 'Software Engineer'}
Required Skills: ${skillsList}

Return ONLY a valid JSON object with no extra text:
{
  "summary": "2-sentence summary of the role",
  "codingTopics": ["topic1", "topic2"],
  "aptitudeAreas": ["area1"],
  "coreSubjects": ["subject1"],
  "interviewTips": ["tip1"],
  "resources": [{ "title": "resource name", "type": "book", "url": null }]
}`;

  try {
    const rawOutput = await invokeAI(prompt, 700);

    const cleaned = rawOutput
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[PlacementParser] No JSON in prep plan AI output');
      return null;
    }

    const plan = JSON.parse(jsonMatch[0]);

    // Ensure all array fields are arrays
    const arrayFields = ['codingTopics', 'aptitudeAreas', 'coreSubjects', 'interviewTips', 'resources'];
    for (const f of arrayFields) {
      if (!Array.isArray(plan[f])) plan[f] = [];
    }

    return plan;
  } catch (err) {
    console.error('[PlacementParser] Prep plan AI error:', err.message);
    return null;
  }
}
