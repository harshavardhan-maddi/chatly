import { randomInt } from "node:crypto";
import { prisma } from "./prisma.js";

// Human-friendly, non-sequential, hard-to-guess IDs like CH-8F92KD
// Alphabet excludes ambiguous characters (0/O, 1/I/L) for readability.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SEGMENT_LENGTH = 6;

function generateSegment(): string {
  let out = "";
  for (let i = 0; i < SEGMENT_LENGTH; i++) {
    // crypto.randomInt is a CSPRNG — not Math.random().
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * Generates a unique Chat ID, retrying on the astronomically unlikely
 * event of a collision (32^6 ≈ 1.07 billion possibilities per segment).
 */
export async function generateUniqueChatId(): Promise<string> {
  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `CH-${generateSegment()}`;
    const existing = await prisma.chat.findUnique({ where: { chatId: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Failed to generate a unique Chat ID after multiple attempts");
}

export function generateInviteCode(): string {
  return `${generateSegment()}${generateSegment()}`;
}

export function generateCallRoomId(): string {
  return `CALL-${generateSegment()}`;
}
