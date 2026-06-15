import { GoogleGenerativeAI } from '@google/generative-ai';

// Collect all configured keys (GEMINI_API_KEY, GEMINI_API_KEY_2 ... GEMINI_API_KEY_5)
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);

// Try models in order — each has its own separate free-tier quota pool
const MODELS_TO_TRY = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-2.0-flash-lite',
];

console.log(`[ExtractText] Loaded ${GEMINI_KEYS.length} Gemini API key(s). Models: ${MODELS_TO_TRY.join(', ')}`);

let visionKeyIndex = 0;

/**
 * Extracts text from a buffer (PDF or image) using Gemini Vision.
 * Rotates through all API keys AND model names to maximise quota headroom.
 * Throws a descriptive error if all combinations fail.
 */
export async function extractTextFromBuffer(buffer, mimetype) {
  if (GEMINI_KEYS.length === 0) {
    throw new Error(
      'No Gemini API keys are configured on the server. Please add GEMINI_API_KEY to your environment variables.'
    );
  }

  const errors = [];

  // Outer loop: try each model name
  for (const modelName of MODELS_TO_TRY) {
    // Inner loop: try each key with this model
    for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
      const keyIdx = (visionKeyIndex + attempt) % GEMINI_KEYS.length;
      const key = GEMINI_KEYS[keyIdx];

      try {
        console.log(`[ExtractText] Trying model=${modelName} key=#${keyIdx + 1} mimetype=${mimetype}`);

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimetype,
              data: buffer.toString('base64'),
            },
          },
          {
            text: 'Extract ALL text content from this document exactly as it appears. Return only the raw text, no formatting, no explanation.',
          },
        ]);

        const extracted = result.response.text()?.trim();
        console.log(
          `[ExtractText] Success! model=${modelName} key=#${keyIdx + 1} extracted ${extracted?.length || 0} chars.`
        );

        // Advance round-robin index for the next call
        visionKeyIndex = (keyIdx + 1) % GEMINI_KEYS.length;
        return extracted || '';

      } catch (err) {
        const isRateLimit =
          err.message?.includes('429') ||
          err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.message?.includes('quota') ||
          err.status === 429;
        const isNotFound = err.message?.includes('404') || err.message?.includes('not found');

        console.warn(
          `[ExtractText] model=${modelName} key=#${keyIdx + 1} failed (${
            isRateLimit ? 'rate-limit' : isNotFound ? 'not-found' : 'error'
          }): ${err.message?.slice(0, 120)}`
        );

        errors.push(`[${modelName}/key#${keyIdx + 1}]: ${err.message?.slice(0, 100)}`);

        // If model not found, skip remaining keys for this model
        if (isNotFound) break;
        // Otherwise try the next key (rate limit may be key-specific for per-minute quotas)
      }
    }
  }

  // All model+key combinations failed
  const summary = errors.slice(0, 3).join(' | ');
  console.error(`[ExtractText] All ${MODELS_TO_TRY.length} models × ${GEMINI_KEYS.length} keys failed.`);
  throw new Error(
    `AI text extraction failed after trying ${MODELS_TO_TRY.length} models × ${GEMINI_KEYS.length} key(s). ` +
    `Most likely cause: free-tier daily quota exhausted for all keys on same project. ` +
    `Use API keys from different Google accounts. First error: ${errors[0] || 'Unknown'}`
  );
}
