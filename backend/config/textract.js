import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'us-east-1';

const textractClient = new TextractClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Extract text from a file stored in S3 using AWS Textract DetectDocumentText.
 * Supports PNG, JPEG, PDF (single-page sync API).
 *
 * @param {string} s3Url - Full S3 URL (https://bucket.s3.region.amazonaws.com/key)
 * @returns {Promise<string>} Extracted text as a single string
 */
export async function extractTextFromFile(s3Url) {
  // Parse bucket and key from S3 URL
  const url = new URL(s3Url);
  const bucket = url.hostname.split('.')[0];
  const key = decodeURIComponent(url.pathname.slice(1)); // remove leading /

  // Fetch file bytes from S3
  const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const s3Response = await s3Client.send(getCmd);

  // Read the stream into a buffer
  const chunks = [];
  for await (const chunk of s3Response.Body) {
    chunks.push(chunk);
  }
  const fileBytes = Buffer.concat(chunks);

  // Call Textract DetectDocumentText
  const detectCmd = new DetectDocumentTextCommand({
    Document: {
      Bytes: fileBytes,
    },
  });

  const textractResponse = await textractClient.send(detectCmd);

  // Extract LINE blocks and join them
  const lines = (textractResponse.Blocks || [])
    .filter((block) => block.BlockType === 'LINE')
    .map((block) => block.Text)
    .filter(Boolean);

  return lines.join('\n');
}
