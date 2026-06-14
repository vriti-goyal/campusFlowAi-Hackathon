import { GoogleGenerativeAI } from "@google/generative-ai";

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
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
      if (err.message?.includes('429') && i < keys.length - 1) {
        continue;
      }
      if (err.message?.includes('429')) {
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
      if (err.message?.includes('429') && i < keys.length - 1) {
        continue;
      }
      if (err.message?.includes('429')) {
        return "I'm a little busy right now. Please try again in a moment.";
      }
      throw err;
    }
  }
}
