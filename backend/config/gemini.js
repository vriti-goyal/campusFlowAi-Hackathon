import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const GEMINI_MODEL = "gemini-2.0-flash";

export async function invokeAIVision(buffer, mimeType, maxTokens = 4096) {
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
  return result.response.text();
}

export async function invokeAI(prompt, maxTokens = 512) {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2,
      topP: 0.9,
    }
  });
  
  return result.response.text();
}
