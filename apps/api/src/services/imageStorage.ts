import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { HttpError, notFound } from "../middleware/errors.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const mediaPathPattern = new RegExp(`^/api/media/(${uuid})/(${uuid}\\.webp)$`);

export function storageEnabled(): boolean {
  return Boolean(config.AWS_ENDPOINT_URL_S3 && config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY && config.IMAGE_BUCKET);
}
let client: S3Client | undefined;
function storage() {
  if (!storageEnabled()) throw new HttpError(503, "storage_unavailable", "رفع الصور غير متاح حاليًا؛ تقدر تستخدم رابط صورة");
  return client ??= new S3Client({
    endpoint: config.AWS_ENDPOINT_URL_S3, region: config.AWS_REGION, forcePathStyle: true, maxAttempts: 2,
    credentials: { accessKeyId: config.AWS_ACCESS_KEY_ID, secretAccessKey: config.AWS_SECRET_ACCESS_KEY }
  });
}
export async function putImage(key: string, bytes: Buffer): Promise<void> {
  await storage().send(new PutObjectCommand({
    Bucket: config.IMAGE_BUCKET, Key: key, Body: bytes, ContentType: "image/webp", CacheControl: "private, no-store"
  }), { abortSignal: AbortSignal.timeout(15_000) });
}
export async function getImage(key: string): Promise<Buffer> {
  try {
    const result = await storage().send(new GetObjectCommand({ Bucket: config.IMAGE_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(15_000) });
    if (!result.Body || (result.ContentLength ?? 0) > MAX_IMAGE_BYTES) throw notFound();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) throw notFound();
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") throw notFound();
    throw error;
  }
}
