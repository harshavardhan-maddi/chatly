import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, ShieldCheck, Video, Users, Lock, FileText, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

const features = [
  { icon: MessageCircle, title: "Real-time messaging", body: "Text, emoji, replies, reactions — delivered instantly." },
  { icon: FileText, title: "File sharing", body: "Images, videos, documents and voice messages, all private by default." },
  { icon: Video, title: "Voice & video calling", body: "One tap to call inside any chat, no separate app required." },
  { icon: Users, title: "Group conferencing", body: "Bring the whole chat into one room with screen sharing." },
  { icon: Lock, title: "Access control", body: "Approval requests, invite-only rooms, member limits — you decide." },
  { icon: ShieldCheck, title: "Privacy & security", body: "Private storage, signed URLs, and role-based permissions throughout." },
];

export default function Landing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [chatId, setChatId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInstantJoin(e: FormEvent) {
    e.preventDefault();
    if (!chatId.trim()) return;

    setError(null);
    setLoading(true);

    try {
      // 1. If not logged in, authenticate as guest
      let currentUser = user;
      if (!currentUser) {
        const guestRes = await api.post("/auth/guest", { name: guestName });
        currentUser = guestRes.data.user;
        setUser(currentUser);
      }

      const formattedChatId = chatId.trim().toUpperCase();

      // 2. Attempt to join the chat directly
      try {
        await api.post("/chats/join", { chatId: formattedChatId });
      } catch (err: any) {
        if (err.response?.status === 403) {
          // If approval required, request to join
          await api.post("/chats/join-requests", { chatId: formattedChatId });
        } else if (err.response?.status !== 400 && err.response?.data?.error !== "Already a member") {
          throw err;
        }
      }

      // 3. Navigate to chat room
      navigate(`/chats/${formattedChatId}`);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to join chat. Please check Chat ID.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <span className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold">C</span>
          Chatly
        </div>
        <nav className="flex items-center gap-3">
          {user ? (
            <Link to="/home" className="px-4 py-2 text-sm font-medium rounded-full bg-brand-500 text-white">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 text-sm font-medium">Login</Link>
              <Link to="/register" className="px-4 py-2 text-sm font-medium rounded-full bg-brand-500 text-white">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="max-w-3xl mx-auto text-center px-6 pt-16 pb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Create a private space.<br />Share one ID.<br />Talk instantly.
        </h1>
        <p className="mt-4 text-neutral-500 dark:text-neutral-400 text-lg max-w-xl mx-auto">
          No sign up required to join. Simply enter a Chat ID and jump straight into the conversation.
        </p>

        {/* Instant Join Card */}
        <div className="mt-8 bg-neutral-50 dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-left max-w-md mx-auto shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            ⚡ Quick Join Chat (No Login Needed)
          </h2>
          <form onSubmit={handleInstantJoin} className="space-y-3">
            {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-800">{error}</p>}
            <div>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 uppercase placeholder:normal-case font-mono font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Enter Chat ID (e.g. CH-8F92KD)"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                required
              />
            </div>
            {!user && (
              <div>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 placeholder:text-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Your Name (e.g. Guest User)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !chatId.trim()}
              className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {loading ? "Joining Chat..." : "Join Chat Now"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-neutral-500">
          <span>Or want to host a room?</span>
          <Link to="/register" className="text-brand-500 font-medium hover:underline">
            Create a Chat Room
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6 py-12">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800">
            <Icon className="w-6 h-6 text-brand-500 mb-3" />
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-neutral-100 dark:border-neutral-800 py-8 text-center text-sm text-neutral-400">
        © {new Date().getFullYear()} Chatly. All rights reserved.
      </footer>
    </div>
  );
}
