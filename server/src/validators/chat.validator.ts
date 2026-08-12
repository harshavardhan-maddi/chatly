import { z } from "zod";

export const createChatSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  image: z.string().url().optional(),
  maxMembers: z.number().int().min(2).max(1000).default(50),
  accessType: z.enum(["PUBLIC", "APPROVAL_REQUIRED", "INVITE_ONLY"]).default("APPROVAL_REQUIRED"),
  messagePermission: z.enum(["EVERYONE", "ADMINS_ONLY", "NOBODY"]).default("EVERYONE"),
  startCallPermission: z.enum(["EVERYONE", "ADMINS_ONLY", "NOBODY"]).default("EVERYONE"),
  joinCallPermission: z.enum(["EVERYONE", "ADMINS_ONLY", "NOBODY"]).default("EVERYONE"),
});

export const joinChatSchema = z.object({
  chatId: z.string().regex(/^CH-[A-Z0-9]{6}$/, "Invalid Chat ID format"),
});

export const updateChatSchema = createChatSchema.partial();
