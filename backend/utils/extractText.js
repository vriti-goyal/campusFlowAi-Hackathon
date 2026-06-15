import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { invokeAIVision } from '../config/gemini.js';

function isPdf(mimetype) {
  return mimetype === 'application/pdf';
}

function isImage(mimetype) {
  return mimetype?.startsWith('image/');
}

async function extractFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    return data?.text?.trim() || '';
  } finally {
    await parser.destroy();
  }
}

async function extractFromImageOCR(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng');
  return result?.data?.text?.trim() || '';
}

export async function extractTextFromBuffer(buffer, mimetype) {
  if (!buffer || !mimetype) {
    throw new Error('File buffer and mimetype are required for text extraction.');
  }

  if (isPdf(mimetype)) {
    const pdfText = await extractFromPdf(buffer);
    if (pdfText) {
      console.log(`[ExtractText] PDF text extracted locally (${pdfText.length} chars).`);
      return pdfText;
    }
    throw new Error('Could not extract text from PDF content.');
  }

  if (isImage(mimetype)) {
    const ocrText = await extractFromImageOCR(buffer);
    if (ocrText && ocrText.length > 40) {
      console.log(`[ExtractText] Image OCR extracted locally (${ocrText.length} chars).`);
      return ocrText;
    }

    try {
      const visionText = await invokeAIVision(buffer, mimetype, 2048);
      if (visionText?.trim()) {
        console.log(`[ExtractText] Image text extracted via Groq vision (${visionText.length} chars).`);
        return visionText.trim();
      }
    } catch (err) {
      console.warn('[ExtractText] Groq vision fallback failed:', err.message);
    }

    return ocrText || '';
  }

  throw new Error(`Unsupported mime type for extraction: ${mimetype}`);
}
