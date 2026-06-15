import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function extractTextFromBuffer(buffer, mimetype) {
  try {
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
    console.log('[ExtractText] Gemini Vision extracted:', extracted?.slice(0, 200));
    return extracted || '';

  } catch (err) {
    console.error('[ExtractText] Gemini Vision failed:', err.message);
    return '';
  }
}
