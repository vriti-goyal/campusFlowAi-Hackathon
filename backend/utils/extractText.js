import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export async function extractTextFromBuffer(buffer, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      const text = data.text?.trim();
      if (!text || text.length < 50) {
        return extractTextFallback(buffer);
      }
      return text;
    }

    // Images — Tesseract
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text?.trim() || '';

  } catch (err) {
    console.error('Text extraction error:', err);
    // Don't throw — return fallback so upload never fully breaks
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
    if (text.length > 50) return text;
    const readable = str.match(/[a-zA-Z0-9 .,:\-\/()]{4,}/g) || [];
    return readable.join(' ').trim();
  } catch {
    return '';
  }
}
