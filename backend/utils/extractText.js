import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export async function extractTextFromBuffer(buffer, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      // Use createRequire to load CommonJS pdf-parse in ESM context
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const text = data.text?.trim();
      if (text && text.length >= 30) return text;
      // Fallback: raw binary string extraction
      return extractTextFallback(buffer);
    }

    // Images — Tesseract OCR
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text?.trim() || '';

  } catch (err) {
    console.error('[ExtractText] Error:', err.message);
    // Never throw — always return something so upload continues
    return extractTextFallback(buffer);
  }
}

function extractTextFallback(buffer) {
  try {
    const str = buffer.toString('latin1');
    const matches = str.match(/BT[\s\S]*?ET/g) || [];
    const text = matches
      .join(' ')
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 30) return text;
    const readable = (str.match(/[a-zA-Z0-9 .,:\-\/()]{4,}/g) || []).join(' ').trim();
    return readable;
  } catch {
    return '';
  }
}
