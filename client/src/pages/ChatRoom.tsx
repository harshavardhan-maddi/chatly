import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useAuthStore } from "../store/authStore";
import { ArrowLeft, Paperclip, Send, Phone, Video } from "lucide-react";

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

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: chat } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => (await api.get<{ chat: ChatDetail }>(`/chats/${chatId}`)).data.chat,
    enabled: !!chatId,
  });

  // Load message history once we know the chat exists.
  useEffect(() => {
    if (!chatId) return;
    api.get(`/chats/${chatId}/messages`).then(({ data }) => setMessages(data.messages));
  }, [chatId]);

  // Join the chat's socket room (server re-verifies membership) and
  // subscribe to live events.
  useEffect(() => {
    if (!chatId || !chat) return;
    const socket = getSocket();

    socket.emit("chat:join", chatId, (ok: boolean) => {
      if (!ok) navigate("/home");
    });

    function onNewMessage(message: Message) {
      setMessages((prev) => [...prev, message]);
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

  function sendMessage() {
    if (!draft.trim() || !chat) return;
    const socket = getSocket();
    socket.emit(
      "message:send",
      { chatId: chat.id, content: draft.trim(), messageType: "TEXT" },
      (res: { error?: string }) => {
        if (res?.error) console.error(res.error);
      },
    );
    setDraft("");
    socket.emit("typing:stop", { chatId: chat.id });
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
      const socket = getSocket();
      socket.emit("message:send", {
        chatId: chat.id,
        messageType: typeMap[data.attachment.category] ?? "DOCUMENT",
        attachment: data.attachment,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!chat) return <div className="p-6 text-neutral-400 text-sm">Loading…</div>;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-neutral-950">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/home")}><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <p className="font-semibold leading-tight">{chat.name}</p>
            <p className="text-xs text-neutral-500">{chat._count.members} members</p>
          </div>
        </div>
        <div className="flex gap-3 text-neutral-500">
          <Phone className="w-5 h-5" />
          <Video className="w-5 h-5" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-neutral-400 text-sm mt-10">Start the conversation 👋</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === currentUser?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${mine ? "bg-brand-500 text-white" : "bg-neutral-100 dark:bg-neutral-900"}`}>
                {!mine && <p className="text-xs font-medium opacity-70 mb-0.5">{m.sender.name}</p>}
                {m.content && <p className="text-sm">{m.content}</p>}
                {m.attachments.map((a) => (
                  <p key={a.id} className="text-sm underline">{a.fileName}</p>
                ))}
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && <p className="text-xs text-neutral-400 italic">typing…</p>}
        <div ref={bottomRef} />
      </main>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
        <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="text-neutral-500">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          className="flex-1 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-transparent"
          placeholder="Type a message..."
          value={draft}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage} className="p-2 rounded-full bg-brand-500 text-white">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
