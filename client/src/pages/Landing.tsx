import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, ShieldCheck, Video, Users, Lock, FileText, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { ChatlyLogo } from "../components/ChatlyLogo";

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
      let currentUser = user;
      if (!currentUser) {
        const guestRes = await api.post("/auth/guest", { name: guestName });
        currentUser = guestRes.data.user;
        setUser(currentUser);
      }

      const formattedChatId = chatId.trim().toUpperCase();

      try {
        await api.post("/chats/join", { chatId: formattedChatId });
      } catch (err: any) {
        if (err.response?.status === 403) {
          await api.post("/chats/join-requests", { chatId: formattedChatId });
        } else if (err.response?.status !== 400 && err.response?.data?.error !== "Already a member") {
          throw err;
        }
      }

      navigate(`/chats/${formattedChatId}`);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to join chat. Please check Chat ID.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-3 group">
          <ChatlyLogo size={40} className="transition-transform duration-300 group-hover:scale-110" />
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Chatly
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <Link to="/home" className="px-5 py-2.5 text-sm font-semibold rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-md transition">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 text-sm font-medium hover:text-brand-500 transition">Login</Link>
              <Link to="/register" className="px-5 py-2.5 text-sm font-semibold rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-md transition">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* App Intro Hero Section with 3D Logo Showcase */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-12 pb-12 flex flex-col items-center">
        <div className="relative mb-6 group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 blur-2xl opacity-40 group-hover:opacity-70 transition duration-500"></div>
          <ChatlyLogo size={120} className="relative hover:scale-105 transition duration-300" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
          Create a private space.<br />
          <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            Share one ID. Talk instantly.
          </span>
        </h1>
        <p className="mt-4 text-neutral-600 dark:text-neutral-400 text-lg max-w-xl mx-auto leading-relaxed">
          The next-gen 3D powered instant chat platform. Simply enter a Chat ID and jump straight into private conversations.
        </p>

        {/* Quick Join Card */}
        <div className="mt-8 bg-neutral-50 dark:bg-neutral-900/90 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 text-left max-w-md w-full mx-auto shadow-xl backdrop-blur-sm">
          <h2 className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            ⚡ Instant Quick Join (No Registration Needed)
          </h2>
          <form onSubmit={handleInstantJoin} className="space-y-3">
            {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800">{error}</p>}
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
                  placeholder="Your Display Name (e.g. Guest User)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !chatId.trim()}
              className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-md"
            >
              {loading ? "Joining Chat..." : "Join Chat Now"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-neutral-500">
          <span>Want to host a room?</span>
          <Link to="/register" className="text-brand-500 font-bold hover:underline">
            Create a Chat Room
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6 py-12">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40 hover:border-brand-500/50 transition">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 dark:bg-brand-950 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-brand-500" />
            </div>
            <h3 className="font-bold mb-1 text-base">{title}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-neutral-100 dark:border-neutral-800 py-8 text-center text-xs text-neutral-400 mt-auto">
        © {new Date().getFullYear()} Chatly. Built with 3D design and end-to-end performance.
      </footer>
    </div>
  );
}
