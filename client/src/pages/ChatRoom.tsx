import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useAuthStore } from "../store/authStore";
import { ArrowLeft, Paperclip, Send, Phone, Video, Users, X } from "lucide-react";

interface Message {
  id: string;
  content: string | null;
  messageType: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; username: string; profileImage?: string | null };
  attachments: { id: string; fileName: string; mimeType: string; fileSize: number }[];
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

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: chat } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => (await api.get<{ chat: ChatDetail }>(`/chats/${chatId}`)).data.chat,
    enabled: !!chatId,
  });

  // Fast background polling every 2.5s to ensure instant receiving across serverless & Vercel
  const { data: fetchedMessages } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => (await api.get<{ messages: Message[] }>(`/chats/${chatId}/messages`)).data.messages,
    enabled: !!chatId,
    refetchInterval: 2500,
  });

  // Sync incoming messages while preserving pending optimistic local messages
  useEffect(() => {
    if (fetchedMessages) {
      setMessages((prev) => {
        const temps = prev.filter((m) => m.id.startsWith("temp-"));
        const serverIds = new Set(fetchedMessages.map((m) => m.id));
        const activeTemps = temps.filter((t) => !serverIds.has(t.id));
        return [...fetchedMessages, ...activeTemps];
      });
    }
  }, [fetchedMessages]);

  // Load members list
  useEffect(() => {
    if (!chatId) return;
    api.get(`/chats/${chatId}/members`).then(({ data }) => setMembers(data.members)).catch(() => {});
  }, [chatId]);

  // Subscribe to real-time WebSockets events
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
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("chat:removed", onChatRemoved);

    return () => {
      socket.emit("chat:leave", chat.id);
      socket.off("message:new", onNewMessage);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("chat:removed", onChatRemoved);
    };
  }, [chatId, chat, navigate, currentUser?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleTyping(value: string) {
    setDraft(value);
    if (!chat) return;
    const socket = getSocket();
    socket.emit(value ? "typing:start" : "typing:stop", { chatId: chat.id });
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !chat || !currentUser) return;

    // Optimistic message object for 0ms Instant UI display
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
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
    };

    // 1. Clear input & render INSTANTLY (0ms) on sender's screen
    setDraft("");
    setMessages((prev) => [...prev, tempMessage]);

    try {
      // 2. Persist to database in background
      const { data } = await api.post(`/chats/${chat.chatId}/messages`, {
        content: text,
        messageType: "TEXT",
      });

      // 3. Replace temporary local message with confirmed server record
      if (data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
      }

      // 4. Emit live socket event
      const socket = getSocket();
      socket.emit("message:send", { chatId: chat.id, content: text, messageType: "TEXT" });
      socket.emit("typing:stop", { chatId: chat.id });
    } catch (err) {
      console.error("Error sending message:", err);
    }
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
    <div className="flex flex-col h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div onClick={() => setShowMembers(true)} className="cursor-pointer">
            <p className="font-semibold leading-tight hover:underline">{chat.name}</p>
            <p className="text-xs text-neutral-500">{members.length || chat._count.members} members · Click for members</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-neutral-500">
          <button onClick={() => setShowMembers(true)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition" title="View Members">
            <Users className="w-5 h-5" />
          </button>
          <Phone className="w-5 h-5 opacity-60" />
          <Video className="w-5 h-5 opacity-60" />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-neutral-400 text-sm my-16">
            <p className="text-2xl mb-2">👋</p>
            <p className="font-medium">No messages yet</p>
            <p className="text-xs text-neutral-500">Send a message to start the conversation!</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUser?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${mine ? "bg-brand-500 text-white rounded-br-none" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-bl-none"}`}>
                {!mine && (
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mb-0.5">
                    {m.sender?.name ?? "Member"}
                  </p>
                )}
                {m.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>}
                {m.attachments?.map((a) => (
                  <p key={a.id} className="text-sm underline mt-1">{a.fileName}</p>
                ))}
                <p className={`text-[10px] mt-1 text-right ${mine ? "text-white/70" : "text-neutral-400"}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && <p className="text-xs text-neutral-400 italic">typing…</p>}
        <div ref={bottomRef} />
      </main>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          className="flex-1 px-4 py-2.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Type a message..."
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
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
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
          </div>
        </div>
      )}
    </div>
  );
}
