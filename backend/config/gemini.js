const GROQ_KEY = process.env.GROQ_API_KEY;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || GROQ_MODEL;

function isRateLimit(status, body) {
  const msg = typeof body === 'string' ? body : JSON.stringify(body || {});
  return status === 429 || /rate|quota|limit/i.test(msg);
}

async function callGroq(messages, { maxTokens, temperature, model }) {
  if (!GROQ_KEY) {
    throw new Error('Missing GROQ_API_KEY. Add GROQ_API_KEY in backend .env and restart server.');
  }
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMsg = data?.error?.message || `Groq API failed with status ${response.status}`;
    if (isRateLimit(response.status, data)) {
      throw new Error(`Groq rate limit/quota hit: ${errMsg}`);
    }
    throw new Error(errMsg);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('Groq returned empty completion content.');
  }
  return text;
}

export async function invokeAI(prompt, maxTokens = 512) {
  return callGroq(
    [{ role: 'user', content: prompt }],
    { maxTokens, temperature: 0.2, model: GROQ_MODEL }
  );
}

export async function invokeAIVision(buffer, mimeType, maxTokens = 4096) {
  if (!mimeType?.startsWith('image/')) {
    throw new Error(`Groq vision supports image input only, got: ${mimeType}`);
  }

  const base64 = buffer.toString('base64');
  const prompt = 'Extract all visible text from this image. Return only extracted text.';

  return callGroq(
    [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    }],
    { maxTokens, temperature: 0, model: GROQ_VISION_MODEL }
  );
}
