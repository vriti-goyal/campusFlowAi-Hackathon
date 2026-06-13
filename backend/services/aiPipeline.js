import { calculatePriorityScore } from './priorityScore.js';

/**
 * STUB — Phase 2 will call AWS Textract + Bedrock here.
 * For now returns a mock extraction that looks like a placement notice.
 *
 * @param {string} fileUrl - S3 file URL (or null for text input)
 * @param {string} batchId
 * @param {string} uploadedBy - Firebase UID
 * @param {string} [rawText] - optional raw text (for text upload path)
 * @returns {object} extraction result
 */
export async function processUpload(fileUrl, batchId, uploadedBy, rawText = null) {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Mock extraction — realistic placement notice
  const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
  const { priorityScore, priorityLevel } = calculatePriorityScore({
    deadline,
    category: 'placement',
    verified: false,
  });

  const extraction = {
    category: 'placement',
    extractedType: 'placement',
    title: 'Google SWE Intern 2025 — On-Campus Drive',
    summary:
      'Google is visiting campus for SWE internship hiring. Eligibility: CS/IT branches, 7.5+ CGPA, 0 backlogs. Test date: online coding round. Apply via the provided link before the deadline.',
    actionRequired: 'Apply before deadline and prepare for online coding round.',
    deadline: deadline.toISOString(),
    priorityScore,
    priorityLevel,
    // Placement-specific fields
    company: 'Google',
    role: 'SWE Intern',
    package: '₹1.2L/month stipend',
    eligibleBranches: ['CSE', 'IT', 'ECE'],
    minimumCgpa: 7.5,
    allowedBacklogs: 0,
    testDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    applicationLink: 'https://careers.google.com/campus',
  };

  return extraction;
}
