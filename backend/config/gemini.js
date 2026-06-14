import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function invokeAI(prompt, maxTokens = 512) {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  
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
