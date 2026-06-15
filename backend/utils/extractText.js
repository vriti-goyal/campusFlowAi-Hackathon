import { GoogleGenerativeAI } from '@google/generative-ai';

// Collect all configured keys (GEMINI_API_KEY, GEMINI_API_KEY_2 ... GEMINI_API_KEY_5)
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);

if (GEMINI_KEYS.length === 0) {
  console.error('[ExtractText] FATAL: No Gemini API keys configured!');
}

let visionKeyIndex = 0;

export async function extractTextFromBuffer(buffer, mimetype) {
  if (GEMINI_KEYS.length === 0) {
    console.error('[ExtractText] No API keys available.');
    return '';
  }

  let lastError;

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = GEMINI_KEYS[(visionKeyIndex + attempt) % GEMINI_KEYS.length];
    try {
      const genAI = new GoogleGenerativeAI(key);
      // Send file directly to Gemini Vision — works for both PDF and images
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimetype,  // 'application/pdf' or 'image/jpeg' etc
            data: buffer.toString('base64'),
          },
        },
        {
          text: 'Extract ALL text content from this document exactly as it appears. Return only the raw text, no formatting, no explanation.',
        },
      ]);

      const extracted = result.response.text()?.trim();
      console.log(`[ExtractText] Gemini Vision (key #${(visionKeyIndex + attempt) % GEMINI_KEYS.length + 1}) extracted: ${extracted?.slice(0, 200)}`);

      // Advance the round-robin index so the next call starts from the next key
      visionKeyIndex = (visionKeyIndex + attempt + 1) % GEMINI_KEYS.length;
      return extracted || '';

    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.status === 429;
      console.warn(`[ExtractText] Key #${(visionKeyIndex + attempt) % GEMINI_KEYS.length + 1} failed: ${err.message}`);
      lastError = err;

      if (!isRateLimit) {
        // Not a rate limit error — don't bother trying other keys
        break;
      }
      // Otherwise try the next key
    }
  }

  console.error('[ExtractText] All Gemini keys exhausted or failed:', lastError?.message);
  return '';
}
