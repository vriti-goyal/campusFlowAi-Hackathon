import { S3Client } from '@aws-sdk/client-s3';
try {
  const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
      accessKeyId: undefined,
      secretAccessKey: undefined,
    },
  });
  console.log('S3Client initialized successfully');
} catch (e) {
  console.error('S3Client initialization failed:', e.message);
}
