import { GoogleGenerativeAI } from "@google/generative-ai";

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);

let keyIndex = 0;
const GEMINI_MODEL = "gemini-1.5-flash";

export async function invokeAIVision(buffer, mimeType, maxTokens = 4096) {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(keyIndex + i) % keys.length];
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const prompt = "Extract all text from this document accurately. Do not add any extra commentary, just return the exact text content found in the document.";
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: buffer.toString("base64"), mimeType } },
            { text: prompt }
          ]
        }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 }
      });
      keyIndex = (keyIndex + i + 1) % keys.length;
      return result.response.text();
    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.status === 429;
      if (isRateLimit && i < keys.length - 1) {
        console.warn(`[Gemini Vision] Key #${(keyIndex + i) % keys.length + 1} rate-limited, trying next key...`);
        continue;
      }
      if (isRateLimit) {
        throw new Error("Rate limit exceeded across all keys. Please try again in a moment.");
      }
      throw err;
    }
  }
}

export async function invokeAI(prompt, maxTokens = 512) {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(keyIndex + i) % keys.length];
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.2,
          topP: 0.9,
        }
      });
      keyIndex = (keyIndex + i + 1) % keys.length;
      return result.response.text();
    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.status === 429;
      if (isRateLimit && i < keys.length - 1) {
        console.warn(`[Gemini] Key #${(keyIndex + i) % keys.length + 1} rate-limited, trying next key...`);
        continue;
      }
      if (isRateLimit) {
        return "I'm a little busy right now. Please try again in a moment.";
      }
      throw err;
    }
  }
}
