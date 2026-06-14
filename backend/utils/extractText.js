import pdfParse from 'pdf-parse';

export async function extractTextFromBuffer(buffer, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      const text = data.text?.trim();
      
      // If pdf-parse got nothing, the PDF is likely scanned/image-based
      if (!text || text.length < 50) {
        return extractTextFallback(buffer);
      }
      return text;
    }

    // For images — use Tesseract
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text?.trim() || '';

  } catch (err) {
    console.error('Text extraction error:', err);
    throw new Error('Could not extract text from file');
  }
}

// Fallback: extract raw readable strings from PDF binary
function extractTextFallback(buffer) {
  try {
    const str = buffer.toString('latin1');
    // Extract text between BT and ET markers (PDF text blocks)
    const matches = str.match(/BT[\s\S]*?ET/g) || [];
    const text = matches
      .join(' ')
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (text.length > 50) return text;
    
    // Last resort: grab any readable ASCII strings > 4 chars
    const readable = str.match(/[a-zA-Z0-9 .,:\-\/()]{4,}/g) || [];
    return readable.join(' ').trim();
  } catch {
    return '';
  }
}
