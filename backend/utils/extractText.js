import { GoogleGenerativeAI } from '@google/generative-ai';

// Collect all configured keys (GEMINI_API_KEY, GEMINI_API_KEY_2 ... GEMINI_API_KEY_5)
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);

console.log(`[ExtractText] Loaded ${GEMINI_KEYS.length} Gemini API key(s).`);

let visionKeyIndex = 0;

/**
 * Extracts text from a buffer (PDF or image) using Gemini Vision.
 * Automatically rotates through all configured API keys on any failure.
 * Throws an error with a useful message if all keys fail.
 */
export async function extractTextFromBuffer(buffer, mimetype) {
  if (GEMINI_KEYS.length === 0) {
    throw new Error('No Gemini API keys are configured on the server. Please add GEMINI_API_KEY to your environment variables.');
  }

  const errors = [];

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const keyIdx = (visionKeyIndex + attempt) % GEMINI_KEYS.length;
    const key = GEMINI_KEYS[keyIdx];

    try {
      console.log(`[ExtractText] Trying key #${keyIdx + 1} for mimetype: ${mimetype}`);

      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      console.log(`[ExtractText] Key #${keyIdx + 1} succeeded. Extracted ${extracted?.length || 0} chars.`);

      // Advance the round-robin index for the next call
      visionKeyIndex = (keyIdx + 1) % GEMINI_KEYS.length;
      return extracted || '';

    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.status === 429;
      const isAuthError = err.message?.includes('API_KEY_INVALID') || err.message?.includes('401') || err.message?.includes('403');

      console.warn(`[ExtractText] Key #${keyIdx + 1} failed (${isRateLimit ? 'rate-limit' : isAuthError ? 'auth-error' : 'other'}): ${err.message}`);
      errors.push(`Key #${keyIdx + 1}: ${err.message}`);

      // Always try the next key — even auth errors might be specific to one key
    }
  }

  // All keys failed — throw with the most useful message
  const summary = errors.join(' | ');
  console.error('[ExtractText] All keys failed:', summary);
  throw new Error(`AI text extraction failed (tried ${GEMINI_KEYS.length} key(s)): ${errors[0] || 'Unknown error'}`);
}
