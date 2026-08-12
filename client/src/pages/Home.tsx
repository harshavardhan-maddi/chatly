import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { Plus, LogIn } from "lucide-react";

interface Chat {
  id: string;
  chatId: string;
  name: string;
  image?: string | null;
  _count: { members: number };
  maxMembers: number;
  myRole: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => (await api.get<{ chats: Chat[] }>("/chats")).data.chats,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <h1 className="text-xl font-bold">Messages</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="p-2 rounded-full border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
            title="Join with Chat ID"
          >
            <LogIn className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="p-2 rounded-full bg-brand-500 text-white hover:bg-brand-600 transition"
            title="Create chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm mb-3">{(error as any)?.response?.data?.error ?? "Failed to load chats"}</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-full bg-brand-500 text-white text-xs font-medium">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">💬</div>
            <p className="font-semibold mb-1">No chats yet</p>
            <p className="text-sm text-neutral-500 mb-6">Create a chat or join one using a Chat ID.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm font-medium">
                Create Chat
              </button>
              <button onClick={() => setShowJoin(true)} className="px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 text-sm font-medium">
                Join Chat
              </button>
            </div>
          </div>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <ul className="space-y-1">
            {data.map((chat) => (
              <li
                key={chat.id}
                onClick={() => navigate(`/chats/${chat.chatId}`)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer transition"
              >
                <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center font-semibold text-brand-600">
                  {chat.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{chat.name}</p>
                  <p className="text-xs text-neutral-500">{chat._count?.members ?? 1} / {chat.maxMembers} members · {chat.chatId}</p>
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
                onClick={() => mutation.mutate()}
                disabled={!name || mutation.isPending}
                className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm font-medium disabled:opacity-60"
              >
                {mutation.isPending ? "Creating…" : "Create Chat"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JoinChatModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        return (await api.post("/chats/join", { chatId })).data;
      } catch (err: any) {
        if (err.response?.status === 403) {
          return (await api.post("/chats/join-requests", { chatId })).data;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Join Chat</h2>
        <input
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent uppercase"
          placeholder="CH-XXXXXX"
          value={chatId}
          onChange={(e) => setChatId(e.target.value.toUpperCase())}
        />
        {mutation.isError && <p className="text-sm text-red-500 mt-2">{(mutation.error as any)?.response?.data?.error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!chatId || mutation.isPending}
            className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {mutation.isPending ? "Joining…" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
