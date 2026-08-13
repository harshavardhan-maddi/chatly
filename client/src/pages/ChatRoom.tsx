import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useAuthStore } from "../store/authStore";
import { ChatlyLogo } from "../components/ChatlyLogo";
import { playSentSound, playReceivedSound } from "../utils/audio";
import { registerGlobalPushSubscription, triggerAppNotification, clearAppBadge } from "../services/pushManager";
import ThemeToggleButton from "../components/ThemeToggleButton";
import {
  ArrowLeft,
  Paperclip,
  Send,
  Phone,
  Video,
  Users,
  X,
  PhoneOff,
  Bell,
  Copy,
  Pencil,
  Trash2,
  Reply,
  Check,
  Info,
  CheckSquare,
  Square,
  Edit3,
  LogOut,
} from "lucide-react";

interface Message {
  id: string;
  chatId: string;
  content: string | null;
  messageType: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; username: string; profileImage?: string | null };
  attachments: { id: string; fileName: string; mimeType: string; fileSize: number }[];
  reads?: { userId: string; readAt: string }[];
  replyTo?: {
    id: string;
    content: string | null;
    messageType: string;
    sender?: { id: string; name: string; username: string };
  } | null;
}

interface ChatDetail {
  id: string;
  chatId: string;
  name: string;
  _count: { members: number };
}

interface MemberItem {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: {
    id: string;
    name: string;
    username: string;
    profileImage?: string | null;
  };
}

interface ActiveCall {
  id: string;
  roomId: string;
  callType: "VOICE" | "VIDEO";
  startedBy: string;
}

function MessageStatusTicks({ message, currentUserId }: { message: Message; currentUserId: string }) {
  if (message.id.startsWith("temp-")) {
    return <span className="text-[10px] text-white/60 font-mono" title="Sending...">✓</span>;
  }

  const reads = message.reads || [];
  const isReadByReceiver = reads.some((r) => r.userId !== currentUserId);

  if (isReadByReceiver) {
    return (
      <span className="text-[11px] font-extrabold text-cyan-300 tracking-tighter" title="Read by receiver (Double Blue Tick)">
        ✓✓
      </span>
    );
  }

  return (
    <span className="text-[11px] font-bold text-white/80 tracking-tighter" title="Delivered (Double Grey Tick)">
      ✓✓
    </span>
  );
}

function MessageTextWithLinks({ text, isMine }: { text: string; isMine: boolean }) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          const href = part.startsWith("www.") ? `https://${part}` : part;
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`underline font-semibold break-all transition ${
                isMine ? "text-cyan-200 hover:text-white" : "text-brand-600 dark:text-brand-400 hover:text-brand-500"
              }`}
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </p>
  );
}

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null);

  // Notifications, Edit, Copy, Reply & Multi-Select States
  const [notificationsGranted, setNotificationsGranted] = useState(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  // Edit Chat Name Modal State
  const [showEditName, setShowEditName] = useState(false);
  const [newChatName, setNewChatName] = useState("");

  // Multi-Select Delete Mode State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  // Touch Swipe Gesture State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [swipeMsgId, setSwipeMsgId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCount = useRef(0);

  const { data: chat } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => (await api.get<{ chat: ChatDetail }>(`/chats/${chatId}`)).data.chat,
    enabled: !!chatId,
  });

  // Automatically focus message input, register background VAPID push, and clear app icon badge
  useEffect(() => {
    if (chat) {
      clearAppBadge();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      registerGlobalPushSubscription();
      return () => clearTimeout(timer);
    }
  }, [chat?.id]);

  // Request Chrome browser notifications permission
  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      alert("Browser notifications are not supported on this device.");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setNotificationsGranted(true);
        showToast("Notifications enabled!");
        await registerGlobalPushSubscription();
        await triggerAppNotification("New Notification", `Message from ${chat?.name || "Chatly"}`, `/chats/${chatId}`);
      } else if (perm === "denied") {
        alert("Notifications are blocked in your browser settings. Tap the lock/tune icon in your browser URL bar to allow notifications.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  async function handleSaveChatName() {
    if (!newChatName.trim() || !chatId) return;
    try {
      await api.patch(`/chats/${chatId}`, { name: newChatName.trim() });
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      showToast("Chat name updated!");
      setShowEditName(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update chat name");
    }
  }

  async function handleLeaveChat() {
    if (!chatId || !confirm(`Are you sure you want to leave "${chat?.name}"?`)) return;
    try {
      await api.post(`/chats/${chatId}/leave`);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate("/home");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to leave chat");
    }
  }

  // Fast 800ms ultra-fast background polling for messages
  const { data: fetchedMessages } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => (await api.get<{ messages: Message[] }>(`/chats/${chatId}/messages`)).data.messages,
    enabled: !!chatId,
    refetchInterval: 800,
  });

  // Background polling every 2s to check for incoming voice/video calls
  const { data: activeCallData } = useQuery({
    queryKey: ["activeCall", chatId],
    queryFn: async () => (await api.get<{ call: ActiveCall | null; roomName?: string }>(`/chats/${chatId}/calls/active`)).data,
    enabled: !!chatId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (activeCallData) {
      setActiveCall(activeCallData.call);
    }
  }, [activeCallData]);

  // Sync incoming messages & fire "Message from <chat name>" alerts + WhatsApp-style incoming sound
  useEffect(() => {
    if (fetchedMessages) {
      setMessages((prev) => {
        const temps = prev.filter((m) => m.id.startsWith("temp-"));
        const serverIds = new Set(fetchedMessages.map((m) => m.id));
        const activeTemps = temps.filter((t) => !serverIds.has(t.id));
        return [...fetchedMessages, ...activeTemps];
      });

      if (fetchedMessages.length > prevMsgCount.current && prevMsgCount.current > 0) {
        const latestMsg = fetchedMessages[fetchedMessages.length - 1];
        if (latestMsg && latestMsg.senderId !== currentUser?.id) {
          playReceivedSound();
          if (Notification.permission === "granted") {
            triggerAppNotification("New Notification", `Message from ${chat?.name || "Chatly"}`, `/chats/${chatId}`);
          }
        }
      }
      prevMsgCount.current = fetchedMessages.length;
    }
  }, [fetchedMessages, currentUser?.id, chatId, chat?.name]);

  // Double Blue Ticks ONLY convert when the receiver OPENS the chat room
  useEffect(() => {
    if (!chatId) return;
    api.post(`/chats/${chatId}/read`).catch(() => {});
  }, [chatId, fetchedMessages?.length]);

  // Load members list
  useEffect(() => {
    if (!chatId) return;
    api.get(`/chats/${chatId}/members`).then(({ data }) => setMembers(data.members)).catch(() => {});
  }, [chatId]);

  // Subscribe to real-time WebSockets events (0ms INSTANT CHAT SCREEN UPDATE ON NEW MESSAGE)
  useEffect(() => {
    if (!chatId || !chat) return;
    const socket = getSocket();

    socket.emit("chat:join", chatId, (ok: boolean) => {
      if (!ok) navigate("/home");
    });

    function onNewMessage(message: Message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });

      if (message.senderId !== currentUser?.id) {
        playReceivedSound();
        if (Notification.permission === "granted") {
          triggerAppNotification("New Notification", `Message from ${chat?.name || "Chatly"}`, `/chats/${chatId}`);
        }
      }
    }

    function onChatUpdated() {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }

    function onTypingStart({ userId }: { userId: string }) {
      if (userId === currentUser?.id) return;
      setTypingUsers((prev) => new Set(prev).add(userId));
    }
    function onTypingStop({ userId }: { userId: string }) {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
    function onChatRemoved() {
      navigate("/home");
    }

    socket.on("message:new", onNewMessage);
    socket.on("chat:updated", onChatUpdated);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("chat:removed", onChatRemoved);

    return () => {
      socket.emit("chat:leave", chat.id);
      socket.off("message:new", onNewMessage);
      socket.off("chat:updated", onChatUpdated);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("chat:removed", onChatRemoved);
    };
  }, [chatId, chat, navigate, currentUser?.id, queryClient]);

  // Instantly position scroll at bottom (most recent message) with 0ms latency upon room open
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length, chat?.id]);

  // Touch Swipe Right Gesture Handlers
  function handleTouchStart(e: React.TouchEvent, msgId: string) {
    if (selectMode) return;
    setTouchStartX(e.touches[0].clientX);
    setSwipeMsgId(msgId);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX === null || selectMode) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    if (deltaX > 0 && deltaX < 90) {
      setSwipeOffset(deltaX);
    }
  }

  function handleTouchEnd(msg: Message) {
    if (swipeOffset > 40 && !selectMode) {
      setReplyingTo(msg);
      inputRef.current?.focus();
      showToast(`Replying to ${msg.sender?.name || "Member"}`);
    }
    setTouchStartX(null);
    setSwipeMsgId(null);
    setSwipeOffset(0);
  }

  // Multi-Select Message Selection
  function toggleMessageSelection(msgId: string) {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      if (next.size === 0) {
        setSelectMode(false);
      }
      return next;
    });
  }

  async function handleBatchDeleteSelected() {
    if (selectedMsgIds.size === 0 || !chatId) return;
    if (!confirm(`Delete ${selectedMsgIds.size} selected message(s)?`)) return;

    const idsToDelete = Array.from(selectedMsgIds);
    try {
      await Promise.all(
        idsToDelete.map((id) => api.delete(`/chats/${chatId}/messages/${id}`).catch(() => {}))
      );
      setMessages((prev) => prev.filter((m) => !selectedMsgIds.has(m.id)));
      showToast(`${idsToDelete.length} message(s) deleted`);
    } catch (err) {
      console.error(err);
    } finally {
      setSelectedMsgIds(new Set());
      setSelectMode(false);
    }
  }

  function handleTyping(value: string) {
    setDraft(value);
    if (!chat) return;
    const socket = getSocket();
    socket.emit(value ? "typing:start" : "typing:stop", { chatId: chat.id });
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !chat || !currentUser) return;

    playSentSound();

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      chatId: chat.id,
      content: text,
      messageType: "TEXT",
      senderId: currentUser.id,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        name: currentUser.name || "You",
        username: currentUser.username,
      },
      attachments: [],
      reads: [],
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            messageType: replyingTo.messageType,
            sender: replyingTo.sender,
          }
        : null,
    };

    const currentReply = replyingTo;
    setDraft("");
    setReplyingTo(null);
    setMessages((prev) => [...prev, tempMessage]);
    inputRef.current?.focus();

    try {
      const { data } = await api.post(`/chats/${chat.chatId}/messages`, {
        content: text,
        messageType: "TEXT",
        replyToMessageId: currentReply?.id,
      });

      if (data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
      }

      const socket = getSocket();
      socket.emit("message:send", { chatId: chat.id, content: text, messageType: "TEXT" });
      socket.emit("typing:stop", { chatId: chat.id });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  }

  async function handleSaveEdit() {
    if (!editingMessage || !editDraft.trim() || !chatId) return;

    try {
      const { data } = await api.patch(`/chats/${chatId}/messages/${editingMessage.id}`, {
        content: editDraft.trim(),
      });

      if (data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === editingMessage.id ? data.message : m)));
        showToast("Message updated!");
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Cannot edit message after it has been seen by the receiver");
    } finally {
      setEditingMessage(null);
      setEditDraft("");
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!chatId || !confirm("Delete this message?")) return;
    try {
      await api.delete(`/chats/${chatId}/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      showToast("Message deleted");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete message");
    }
  }

  function handleCopyMessage(text: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  }

  async function startOrJoinCall(type: "VOICE" | "VIDEO") {
    if (!chat || !chatId) return;
    try {
      const res = await api.post(`/chats/${chatId}/calls`, { callType: type });
      const { roomName, jitsiDomain } = res.data;
      const url = `https://${jitsiDomain}/${roomName}#config.startWithAudioMuted=${type === "VIDEO" ? "false" : "false"}&config.startWithVideoMuted=${type === "VOICE" ? "true" : "false"}`;
      setCallRoomUrl(url);
      setInCall(true);
    } catch (err) {
      console.error("Failed to start call:", err);
    }
  }

  async function handleEndCall() {
    if (activeCall && chatId) {
      await api.post(`/chats/${chatId}/calls/${activeCall.id}/end`).catch(() => {});
    }
    setInCall(false);
    setCallRoomUrl(null);
    setActiveCall(null);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !chat) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(`/chats/${chat.chatId}/uploads`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const typeMap: Record<string, string> = { IMAGE: "IMAGE", VIDEO: "VIDEO", DOCUMENT: "DOCUMENT", AUDIO: "AUDIO", VOICE: "VOICE" };
      const messageType = typeMap[data.attachment.category] ?? "DOCUMENT";

      const res = await api.post(`/chats/${chat.chatId}/messages`, {
        messageType,
        attachment: data.attachment,
      });

      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data.message]);
        playSentSound();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!chat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 text-neutral-400">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xl border border-neutral-800 animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Header Bar or Multi-Select Header */}
      {selectMode ? (
        <header className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white shadow-md z-10 animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectMode(false);
                setSelectedMsgIds(new Set());
              }}
              className="p-1 hover:bg-brand-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm">{selectedMsgIds.size} Selected</span>
          </div>
          <button
            onClick={handleBatchDeleteSelected}
            disabled={selectedMsgIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-full text-xs font-bold transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Delete ({selectedMsgIds.size})
          </button>
        </header>
      ) : (
        <header className="flex items-center justify-between px-3 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate("/home")} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ChatlyLogo size={32} />
            <div className="flex items-center gap-1.5 min-w-0">
              <div onClick={() => setShowMembers(true)} className="cursor-pointer min-w-0">
                <p className="font-semibold leading-tight hover:underline truncate">{chat.name}</p>
                <p className="text-xs text-neutral-500 truncate">{members.length || chat._count.members} members</p>
              </div>
              <button
                onClick={() => {
                  setNewChatName(chat.name);
                  setShowEditName(true);
                }}
                className="p-1 text-neutral-400 hover:text-brand-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition"
                title="Edit Chat Name"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggleButton />
            <button
              onClick={requestNotificationPermission}
              className={`p-1.5 rounded-full transition ${
                notificationsGranted
                  ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  : "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 animate-bounce"
              }`}
              title={notificationsGranted ? "Notifications Active" : "Enable Browser Notifications"}
            >
              <Bell className="w-4 h-4" />
            </button>
            <button onClick={() => setShowMembers(true)} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition" title="View Members">
              <Users className="w-4 h-4" />
            </button>
            <button onClick={() => startOrJoinCall("VOICE")} className="p-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition" title="Voice Call">
              <Phone className="w-4 h-4 text-brand-500" />
            </button>
            <button onClick={() => startOrJoinCall("VIDEO")} className="p-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition" title="Video Call">
              <Video className="w-4 h-4 text-brand-500" />
            </button>
            <button onClick={handleLeaveChat} className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-full transition" title="Leave Chat">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Active Call Banner */}
      {activeCall && !inCall && (
        <div className="bg-emerald-500 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-sm animate-pulse">
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4" /> Live {activeCall.callType} Call in progress
          </span>
          <button
            onClick={() => startOrJoinCall(activeCall.callType)}
            className="bg-white text-emerald-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-emerald-50 transition"
          >
            Join Call
          </button>
        </div>
      )}

      {/* Messages List Container */}
      <main ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 select-none">
        {messages.length === 0 && (
          <div className="text-center text-neutral-400 text-sm my-16">
            <p className="text-2xl mb-2">👋</p>
            <p className="font-medium">No messages yet</p>
            <p className="text-xs text-neutral-500">Send a message or start a call!</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUser?.id;
          const reads = m.reads || [];
          const isReadByReceiver = reads.some((r) => r.userId !== currentUser?.id);
          const canEdit = mine && !isReadByReceiver && m.content && !m.id.startsWith("temp-");
          const isSwiping = swipeMsgId === m.id;
          const currentOffset = isSwiping ? swipeOffset : 0;
          const isSelected = selectedMsgIds.has(m.id);

          return (
            <div
              key={m.id}
              className={`flex items-center gap-2 ${mine ? "justify-end" : "justify-start"} group relative transition-transform duration-75`}
              style={{ transform: `translateX(${currentOffset}px)` }}
              onTouchStart={(e) => handleTouchStart(e, m.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => handleTouchEnd(m)}
              onClick={() => {
                if (selectMode) {
                  toggleMessageSelection(m.id);
                } else {
                  setActiveActionId(activeActionId === m.id ? null : m.id);
                }
              }}
            >
              {/* Checkbox for Select Mode */}
              {selectMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMessageSelection(m.id);
                  }}
                  className="text-brand-500 p-1 cursor-pointer"
                >
                  {isSelected ? <CheckSquare className="w-5 h-5 fill-brand-500 text-white" /> : <Square className="w-5 h-5 text-neutral-400" />}
                </button>
              )}

              <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[80%]`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm relative transition-all ${
                    isSelected ? "ring-2 ring-brand-500" : ""
                  } ${
                    mine
                      ? "bg-brand-500 text-white rounded-br-none"
                      : "bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-bl-none"
                  }`}
                >
                  {!mine && (
                    <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-0.5">
                      {m.sender?.name ?? "Member"}
                    </p>
                  )}

                  {/* Quoted Reply Box */}
                  {m.replyTo && (
                    <div
                      className={`mb-2 p-2 rounded-xl text-xs border-l-4 ${
                        mine
                          ? "bg-white/10 border-white/80 text-white/90"
                          : "bg-neutral-200/60 dark:bg-neutral-800 border-brand-500 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <p className="font-bold text-[11px]">{m.replyTo.sender?.name || "Member"}</p>
                      <p className="truncate text-[11px] opacity-90">{m.replyTo.content || "Attachment"}</p>
                    </div>
                  )}

                  {/* Editing Inline Mode */}
                  {editingMessage?.id === m.id ? (
                    <div className="flex flex-col gap-2 my-1 min-w-[200px]">
                      <input
                        ref={editInputRef}
                        className="w-full px-3 py-1.5 text-sm rounded-xl bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white border border-brand-400 focus:outline-none"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingMessage(null);
                        }}
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingMessage(null)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.content && <MessageTextWithLinks text={m.content} isMine={mine} />}
                      {m.attachments?.map((a) => (
                        <p key={a.id} className="text-sm underline mt-1">{a.fileName}</p>
                      ))}
                    </>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className={`text-[10px] ${mine ? "text-white/70" : "text-neutral-400"}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine && <MessageStatusTicks message={m} currentUserId={currentUser?.id || ""} />}
                  </div>
                </div>

                {/* Message Action Toolbar */}
                {!selectMode && (
                  <div
                    className={`flex items-center gap-1 mt-1 px-2.5 py-1 rounded-full bg-neutral-900/90 text-white text-[11px] shadow-lg backdrop-blur-sm transition-opacity duration-200 ${
                      activeActionId === m.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoMessage(m);
                      }}
                      className="p-1 hover:text-cyan-400 flex items-center gap-1"
                      title="Message Info"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(m);
                        inputRef.current?.focus();
                      }}
                      className="p-1 hover:text-cyan-400 flex items-center gap-1"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMessage(m.content);
                      }}
                      className="p-1 hover:text-cyan-400 flex items-center gap-1"
                      title="Copy message"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectMode(true);
                        toggleMessageSelection(m.id);
                      }}
                      className="p-1 hover:text-amber-400 flex items-center gap-1"
                      title="Select Messages"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMessage(m);
                          setEditDraft(m.content || "");
                          setTimeout(() => editInputRef.current?.focus(), 100);
                        }}
                        className="p-1 hover:text-emerald-400 flex items-center gap-1"
                        title="Edit message"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {mine && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMessage(m.id);
                        }}
                        className="p-1 hover:text-red-400 flex items-center gap-1"
                        title="Delete message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && <p className="text-xs text-neutral-400 italic">typing…</p>}
        <div ref={bottomRef} />
      </main>

      {/* Quoted Reply Preview Bar */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-100 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 text-xs">
          <div className="border-l-4 border-brand-500 pl-2 min-w-0">
            <p className="font-bold text-brand-600 dark:text-brand-400">
              Replying to {replyingTo.sender?.name || "Member"}
            </p>
            <p className="text-neutral-500 truncate">{replyingTo.content || "Attachment"}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          autoFocus
          className="flex-1 px-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
          value={draft}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim()}
          className="p-2.5 rounded-full bg-brand-500 hover:bg-brand-600 active:scale-95 text-white transition disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Edit Chat Name Modal */}
      {showEditName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-brand-500" /> Edit Chat Name
            </h3>
            <input
              type="text"
              className="w-full px-4 py-3 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              placeholder="Chat Name"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowEditName(false)} className="px-4 py-2 text-xs rounded-full text-neutral-500">
                Cancel
              </button>
              <button
                onClick={handleSaveChatName}
                disabled={!newChatName.trim()}
                className="px-5 py-2 text-xs rounded-full bg-brand-500 hover:bg-brand-600 text-white font-bold transition disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Info Modal */}
      {infoMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3 mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Info className="w-5 h-5 text-brand-500" /> Message Info
              </h3>
              <button onClick={() => setInfoMessage(null)} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-neutral-100 dark:bg-neutral-950 p-3 rounded-2xl mb-5 text-xs">
              <p className="font-bold text-brand-600 dark:text-brand-400 mb-1">
                {infoMessage.sender?.name || "Member"}
              </p>
              <p className="text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">{infoMessage.content || "Attachment"}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-neutral-100 dark:border-neutral-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">✓✓</span>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">Read / Seen</p>
                    <p className="text-[11px] text-neutral-400">
                      {infoMessage.reads && infoMessage.reads.length > 0
                        ? new Date(infoMessage.reads[0].readAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                        : "Not seen yet"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between border-b border-neutral-100 dark:border-neutral-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 font-bold">✓✓</span>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">Delivered</p>
                    <p className="text-[11px] text-neutral-400">
                      {new Date(infoMessage.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 font-bold">✓</span>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">Sent</p>
                    <p className="text-[11px] text-neutral-400">
                      {new Date(infoMessage.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setInfoMessage(null)}
              className="mt-6 w-full py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Live Voice / Video Call Modal */}
      {inCall && callRoomUrl && (
        <div className="absolute inset-0 bg-neutral-950 z-50 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-900">
            <p className="font-semibold text-sm text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Active Call — {chat.name}
            </p>
            <button
              onClick={handleEndCall}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold flex items-center gap-1"
            >
              <PhoneOff className="w-4 h-4" /> End Call
            </button>
          </div>
          <iframe
            src={callRoomUrl}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            className="w-full flex-1 border-0"
            title="Chatly Voice/Video Call"
          />
        </div>
      )}

      {/* Members Modal */}
      {showMembers && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3 mb-4">
              <h2 className="text-lg font-bold">Chat Members ({members.length})</h2>
              <button onClick={() => setShowMembers(false)} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-4">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center font-semibold text-brand-600">
                      {m.user.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{m.user.name}</p>
                      <p className="text-xs text-neutral-500">@{m.user.username}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${m.role === "OWNER" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : m.role === "ADMIN" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleLeaveChat}
              className="w-full py-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" /> Leave Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
