import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

const client = new S3Client({
  region: "auto",
  endpoint: env.storage.endpoint || undefined,
  credentials: {
    accessKeyId: env.storage.accessKey,
    secretAccessKey: env.storage.secretKey,
  },
  forcePathStyle: true, // required for Supabase Storage / most S3-compatible providers
});

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — short-lived by design

/**
 * Generates a private object key. Never derived from user input directly,
 * to prevent path traversal or collisions across chats.
 */
export function buildObjectKey(chatId: string, originalFileName: string) {
  const ext = originalFileName.includes(".") ? originalFileName.split(".").pop() : "";
  const safeName = randomUUID();
  return `chats/${chatId}/${safeName}${ext ? `.${ext}` : ""}`;
}

export async function uploadObject(key: string, body: Buffer, mimeType: string) {
  await client.send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      // Bucket itself must be private — we never set a public ACL here.
    }),
  );
  return key;
}

/**
 * Returns a short-lived signed URL. A user can never reach a private file
 * just by guessing or modifying an object key — this is the only sanctioned
 * path to read one, and it's only ever called after a permission check
 * (see attachment.controller.ts).
 */
export async function getSignedDownloadUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: env.storage.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export async function deleteObject(key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }));
}
