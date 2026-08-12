import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireChatMembership, requireRole } from "../middleware/chatAuthz.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import * as chatController from "../controllers/chat.controller.js";
import * as memberController from "../controllers/member.controller.js";
import * as messageController from "../controllers/message.controller.js";
import * as uploadController from "../controllers/upload.controller.js";
import * as chatSettingsController from "../controllers/chatSettings.controller.js";
import * as callController from "../controllers/call.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", chatController.createChat);
router.get("/", chatController.listMyChats);
router.post("/join", chatController.joinChat);
router.post("/join-requests", chatController.requestToJoin);
router.patch("/join-requests/:requestId", chatController.reviewJoinRequest);

router.get("/:chatId", chatController.getChat);

// Everything below requires active membership in :chatId.
router.use("/:chatId", requireChatMembership());

router.get("/:chatId/join-requests", requireRole("OWNER", "ADMIN"), chatSettingsController.listJoinRequests);
router.patch("/:chatId", requireRole("OWNER"), chatSettingsController.updateChat);
router.delete("/:chatId", requireRole("OWNER"), chatSettingsController.deleteChat);
router.post("/:chatId/leave", chatSettingsController.leaveChat);
router.post("/:chatId/regenerate-id", requireRole("OWNER"), chatSettingsController.regenerateChatId);
router.post("/:chatId/transfer-ownership", requireRole("OWNER"), chatSettingsController.transferOwnership);

// Members
router.get("/:chatId/members", memberController.listMembers);
router.patch("/:chatId/members/:userId", requireRole("OWNER"), memberController.updateMemberRole);
router.delete("/:chatId/members/:userId", requireRole("OWNER", "ADMIN"), memberController.removeMember);
router.post("/:chatId/members/:userId/ban", requireRole("OWNER", "ADMIN"), memberController.banMember);
router.post("/:chatId/members/:userId/unban", requireRole("OWNER", "ADMIN"), memberController.unbanMember);

// Messages
router.get("/:chatId/messages", messageController.listMessages);
router.post("/:chatId/messages", messageController.createMessage);
router.patch("/:chatId/messages/:messageId", messageController.updateMessage);
router.post("/:chatId/read", messageController.markChatAsRead);
router.delete("/:chatId/messages/:messageId", messageController.deleteMessage);
router.get(
  "/:chatId/messages/:messageId/attachments/:attachmentId/url",
  messageController.getAttachmentUrl,
);

// Calls
router.post("/:chatId/calls", callController.startCall);
router.get("/:chatId/calls/active", callController.getActiveCall);
router.post("/:chatId/calls/:callId/end", callController.endCall);

// Uploads
router.post("/:chatId/uploads", upload.single("file"), uploadController.uploadFile);

export default router;
