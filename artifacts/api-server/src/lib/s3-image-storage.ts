import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const extensionByContentType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

type S3ImageStorageConfig = {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
};

let cachedConfig: S3ImageStorageConfig | null | undefined;

function readConfig(): S3ImageStorageConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    cachedConfig = null;
    return cachedConfig;
  }

  cachedConfig = {
    client: new S3Client({
      endpoint,
      region,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
    publicBaseUrl,
  };
  return cachedConfig;
}

export function isS3ImageStorageConfigured(): boolean {
  return readConfig() !== null;
}

export async function createImageUploadUrl(contentType: string, size: number): Promise<{
  uploadUrl: string;
  publicUrl: string;
}> {
  if (!allowedImageTypes.has(contentType)) {
    throw new Error("Unsupported image type");
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    throw new Error("Image size must be between 1 byte and 2MB");
  }

  const config = readConfig();
  if (!config) {
    throw new Error("S3 image storage is not configured");
  }

  const key = `images/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extensionByContentType[contentType]}`;
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  return {
    uploadUrl: await getSignedUrl(config.client, command, { expiresIn: 600 }),
    publicUrl: `${config.publicBaseUrl}/${key}`,
  };
}