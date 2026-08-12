import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (user) {
      navigate("/home", { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      setUser(data.user);
      navigate("/home", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 px-6">
      <div className="w-full max-w-sm">
        {/* 3D Animated Logo Intro Header */}
        <Link to="/" className="flex flex-col items-center gap-2 mb-8 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 blur-xl opacity-50 group-hover:opacity-80 transition duration-300"></div>
            <img src="/favicon.svg" alt="Chatly 3D Logo" className="relative w-16 h-16 drop-shadow-xl" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Chatly
          </span>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4 bg-neutral-50 dark:bg-neutral-900/60 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-lg">
          <h1 className="text-xl font-bold text-center mb-2">Welcome Back</h1>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800">{error}</p>}
          <div>
            <label className="block text-xs font-semibold mb-1 text-neutral-500">Username or Email</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-neutral-500">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition text-white font-bold text-sm shadow-md disabled:opacity-60 cursor-pointer mt-2"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <p className="text-xs text-center text-neutral-500 pt-2">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-500 font-bold hover:underline">
              Sign Up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
