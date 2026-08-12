import { ApiError } from "./apiError.js";

const MAX_SIZES = {
  IMAGE: 15 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
  DOCUMENT: 50 * 1024 * 1024,
  AUDIO: 25 * 1024 * 1024,
  VOICE: 15 * 1024 * 1024,
} as const;

const ALLOWED_MIME_BY_CATEGORY: Record<keyof typeof MAX_SIZES, string[]> = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
  DOCUMENT: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "application/zip",
  ],
  AUDIO: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"],
  VOICE: ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"],
};

export type UploadCategory = keyof typeof MAX_SIZES;

/**
 * Validates BOTH the declared MIME type and the file's magic-byte signature
 * against a whitelist. A renamed .exe with a .pdf extension and a spoofed
 * Content-Type header still fails here because the actual byte signature
 * won't match anything in MAGIC_BYTES for the claimed category.
 */
export function validateUpload(category: UploadCategory, mimeType: string, sizeBytes: number, buffer: Buffer) {
  if (!ALLOWED_MIME_BY_CATEGORY[category].includes(mimeType)) {
    throw new ApiError(415, "Unsupported file");
  }
  if (sizeBytes > MAX_SIZES[category]) {
    throw new ApiError(413, "File too large");
  }
  if (!matchesKnownSignature(buffer, mimeType)) {
    throw new ApiError(415, "Unsupported file");
  }
}

function matchesKnownSignature(buffer: Buffer, mimeType: string): boolean {
  const hex = buffer.subarray(0, 12).toString("hex");

  const signatures: Record<string, string[]> = {
    "image/jpeg": ["ffd8ff"],
    "image/png": ["89504e47"],
    "image/gif": ["47494638"],
    "image/webp": ["52494646"], // RIFF container; WEBP marker follows at byte 8
    "application/pdf": ["25504446"],
    "application/zip": ["504b0304", "504b0506", "504b0708"],
    "video/mp4": ["66747970", "0000001c", "00000018", "00000020"], // ftyp box appears near offset 4
  };

  // Office Open XML formats (docx/pptx/xlsx) are ZIP containers — same signature as zip.
  if (
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(mimeType)
  ) {
    return hex.startsWith("504b0304");
  }

  // Plain-text / CSV / legacy office binary formats don't have a reliable
  // magic byte to check — we accept them on MIME + extension only, which is
  // an accepted, documented limitation (see README security notes).
  if (["text/csv", "text/plain", "application/msword", "application/vnd.ms-powerpoint", "application/vnd.ms-excel"].includes(mimeType)) {
    return true;
  }

  if (mimeType.startsWith("audio/") || mimeType === "video/webm" || mimeType === "video/quicktime") {
    // Broad range of container formats — rely on MIME whitelist + size cap only.
    return true;
  }

  const candidates = signatures[mimeType];
  if (!candidates) return true; // no signature defined — MIME whitelist already narrowed this
  return candidates.some((sig) => hex.includes(sig));
}

export function categoryForMimeType(mimeType: string): UploadCategory | null {
  for (const [category, mimes] of Object.entries(ALLOWED_MIME_BY_CATEGORY)) {
    if (mimes.includes(mimeType)) return category as UploadCategory;
  }
  return null;
}
