import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Plus, LogIn, LogOut, Trash2 } from "lucide-react";
import ThemeToggleButton from "../components/ThemeToggleButton";

interface Chat {
  id: string;
  chatId: string;
  name: string;
  image?: string | null;
  _count: { members: number };
  maxMembers: number;
  myRole: string;
  unreadCount?: number;
}

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => (await api.get<{ chats: Chat[] }>("/chats")).data.chats,
    refetchInterval: 2000,
  });

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {}
    setUser(null);
    localStorage.removeItem("chatly-auth-user");
    localStorage.removeItem("chatly_access_token");
    navigate("/", { replace: true });
  }

  async function handleDeleteChat(e: React.MouseEvent, chatId: string, chatName: string) {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${chatName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/chats/${chatId}`);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete chat");
    }
  }

  async function handleLeaveChat(e: React.MouseEvent, chatId: string, chatName: string) {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to leave "${chatName}"?`)) {
      return;
    }
    try {
      await api.post(`/chats/${chatId}/leave`);
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to leave chat");
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <Link to="/" className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Chatly 3D Logo" className="w-8 h-8 drop-shadow-md" />
          <div>
            <h1 className="text-lg font-bold leading-tight bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              Chatly
            </h1>
            {user && (
              <p className="text-[11px] text-neutral-500">
                Logged in as <span className="font-semibold text-brand-500">{user.name}</span>
              </p>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-xs font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          >
            <LogIn className="w-3.5 h-3.5" /> Join
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Your Chats</h2>
          <span className="text-xs text-neutral-400 font-medium">{data?.length ?? 0} active</span>
        </div>

        {isLoading ? (
          <div className="text-center text-neutral-400 py-16">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading your chats…</p>
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-red-500">
            <p className="text-sm font-semibold mb-2">Failed to load chats</p>
            <p className="text-xs text-neutral-500 mb-4">{(error as any)?.response?.data?.error || (error as Error).message}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-1.5 bg-brand-500 text-white rounded-full text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : data?.length === 0 ? (
          <div className="text-center py-16 text-neutral-400">
            <p className="text-3xl mb-2">💬</p>
            <p className="font-semibold text-sm mb-1">No chats yet</p>
            <p className="text-xs text-neutral-500 mb-4">Join an existing room using a Chat ID or create your own space.</p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowJoin(true)}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-200 transition"
              >
                Join with ID
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-brand-500 text-white rounded-full text-xs font-bold hover:bg-brand-600 transition"
              >
                Create Chat
              </button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {data?.map((chat) => (
              <li
                key={chat.id}
                onClick={() => navigate(`/chats/${chat.chatId}`)}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/40 hover:border-brand-500/40 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/80 cursor-pointer transition group"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">{chat.name}</p>
                    {chat.unreadCount && chat.unreadCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold animate-pulse">
                        {chat.unreadCount} new
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-neutral-500">{chat._count?.members ?? 1} / {chat.maxMembers} members · ID: {chat.chatId}</p>
                </div>
                <div className="flex items-center gap-1">
                  {chat.myRole === "OWNER" ? (
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.chatId, chat.name)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition opacity-0 group-hover:opacity-100"
                      title="Delete Chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleLeaveChat(e, chat.chatId, chat.name)}
                      className="p-2 text-neutral-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-full transition opacity-0 group-hover:opacity-100"
                      title="Leave Chat"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showCreate && <CreateChatModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinChatModal onClose={() => setShowJoin(false)} />}
    </div>
  );
}

function CreateChatModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);
  const [accessType, setAccessType] = useState<"PUBLIC" | "APPROVAL_REQUIRED" | "INVITE_ONLY">("APPROVAL_REQUIRED");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post("/chats", { name, description, maxMembers, accessType })).data.chat,
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setCreatedId(chat.chatId);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6">
        {createdId ? (
          <div className="text-center">
            <p className="font-semibold mb-2">Chat created!</p>
            <p className="text-2xl font-mono font-bold text-brand-500 mb-4">{createdId}</p>
            <p className="text-sm text-neutral-500 mb-6">Share this Chat ID so others can join.</p>
            <button onClick={onClose} className="px-4 py-2 rounded-full bg-brand-500 text-white">Done</button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-4">Create Chat</h2>
            <div className="space-y-3">
              <input className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent" placeholder="Chat Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <input type="number" min={2} className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent" placeholder="Maximum Members" value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} />
              <select className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent" value={accessType} onChange={(e) => setAccessType(e.target.value as any)}>
                <option value="PUBLIC">Anyone with Chat ID</option>
                <option value="APPROVAL_REQUIRED">Approval Required</option>
                <option value="INVITE_ONLY">Invite Only</option>
              </select>
            </div>
            {mutation.isError && <p className="text-sm text-red-500 mt-2">{(mutation.error as any)?.response?.data?.error}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={onClose} className="px-4 py-2 rounded-full text-sm">Cancel</button>
              <button
                disabled={!name || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {mutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JoinChatModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const formatted = chatId.trim().toUpperCase();
      try {
        await api.post("/chats/join", { chatId: formatted });
        return { joined: true, chatId: formatted };
      } catch (err: any) {
        if (err.response?.status === 403) {
          await api.post("/chats/join-requests", { chatId: formatted });
          return { joined: false, requestId: true, chatId: formatted };
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      if (res.joined) {
        onClose();
        navigate(`/chats/${res.chatId}`);
      } else {
        setStatus("Join request submitted! Waiting for owner/admin approval.");
      }
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Join a Chat</h2>
        {status ? (
          <div>
            <p className="text-sm mb-6">{status}</p>
            <button onClick={onClose} className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm">Done</button>
          </div>
        ) : (
          <>
            <input
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent uppercase font-mono mb-2"
              placeholder="Chat ID (e.g. CH-8F92KD)"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            {mutation.isError && (
              <p className="text-xs text-red-500 mb-2 font-medium">
                {(mutation.error as any)?.response?.data?.error || "Failed to join chat. Please check Chat ID."}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={onClose} className="px-4 py-2 rounded-full text-sm">Cancel</button>
              <button
                disabled={!chatId || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {mutation.isPending ? "Joining..." : "Join"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
