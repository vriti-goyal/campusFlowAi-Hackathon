/**
 * Calculate a priority score (0-100) using simple rules.
 * Phase 2 will replace this with AI-based scoring.
 *
 * @param {{ deadline?: Date|string, category?: string, verified?: boolean }} params
 * @returns {{ priorityScore: number, priorityLevel: string }}
 */
export function calculatePriorityScore({ deadline, category, verified } = {}) {
  let score = 50; // base score

  // Deadline proximity — closer = higher
  if (deadline) {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.max(0, (deadlineDate - now) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 1) score = 95;
    else if (daysLeft <= 3) score = 85;
    else if (daysLeft <= 7) score = 70;
    else if (daysLeft <= 14) score = 55;
    else score = 40;
  }

  // Category boost
  if (category === 'placement') score = Math.min(100, score + 10);
  if (category === 'exam') score = Math.min(100, score + 5);

  // Unverified penalty
  if (verified === false) score = Math.max(0, score - 5);

  // Derive level
  let priorityLevel;
  if (score >= 85) priorityLevel = 'critical';
  else if (score >= 65) priorityLevel = 'high';
  else if (score >= 40) priorityLevel = 'medium';
  else priorityLevel = 'low';

  return { priorityScore: score, priorityLevel };
}
