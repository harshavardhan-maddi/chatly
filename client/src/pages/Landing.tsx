import { Link } from "react-router-dom";
import { MessageCircle, ShieldCheck, Video, Users, Lock, FileText } from "lucide-react";

const features = [
  { icon: MessageCircle, title: "Real-time messaging", body: "Text, emoji, replies, reactions — delivered instantly." },
  { icon: FileText, title: "File sharing", body: "Images, videos, documents and voice messages, all private by default." },
  { icon: Video, title: "Voice & video calling", body: "One tap to call inside any chat, no separate app required." },
  { icon: Users, title: "Group conferencing", body: "Bring the whole chat into one room with screen sharing." },
  { icon: Lock, title: "Access control", body: "Approval requests, invite-only rooms, member limits — you decide." },
  { icon: ShieldCheck, title: "Privacy & security", body: "Private storage, signed URLs, and role-based permissions throughout." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <span className="w-8 h-8 rounded-xl2 bg-brand-500 flex items-center justify-center text-white">C</span>
          Chatly
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm font-medium">Login</Link>
          <Link to="/register" className="px-4 py-2 text-sm font-medium rounded-full bg-brand-500 text-white">
            Get Started
          </Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto text-center px-6 py-24">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Create a private space.<br />Share one ID.<br />Stay connected.
        </h1>
        <p className="mt-6 text-neutral-500 dark:text-neutral-400 text-lg">
          Chatly gives every conversation a unique Chat ID — share it, control who joins,
          and talk in real time with messages, files, and calls.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/register" className="px-6 py-3 rounded-full bg-brand-500 text-white font-medium">
            Create Chat
          </Link>
          <Link to="/login" className="px-6 py-3 rounded-full border border-neutral-200 dark:border-neutral-800 font-medium">
            Join Chat
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6 pb-24">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="p-6 rounded-xl2 border border-neutral-100 dark:border-neutral-800">
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
