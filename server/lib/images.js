const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { HttpError } = require('./http');

const s3 = new S3Client({ region: process.env.AWS_REGION });

// decide the real type from the first bytes, never from the file name or header
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: '.jpg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: '.png' };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { type: 'image/webp', ext: '.webp' };
  return null;
}

// returns the public path (CloudFront serves /images/*)
async function saveImage(buffer) {
  const kind = sniffImage(buffer);
  if (!kind) throw new HttpError(400, 'That file is not a JPG, PNG or WebP image');
  const key = `images/${crypto.randomUUID()}${kind.ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: kind.type,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return '/' + key;
}

module.exports = { sniffImage, saveImage };
