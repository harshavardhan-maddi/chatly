import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import ThemeToggleButton from "../components/ThemeToggleButton";

export default function Register() {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirmPassword: "" });
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

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUser(data.user);
      navigate("/home", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Registration failed. Username or email may already be taken.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 px-6 py-12 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggleButton />
      </div>
      <div className="w-full max-w-sm">
        {/* 3D Animated Logo Intro Header */}
        <Link to="/" className="flex flex-col items-center gap-2 mb-6 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 blur-xl opacity-50 group-hover:opacity-80 transition duration-300"></div>
            <img src="/favicon.svg" alt="Chatly 3D Logo" className="relative w-14 h-14 drop-shadow-xl" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Chatly
          </span>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-3 bg-neutral-50 dark:bg-neutral-900/60 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-lg">
          <h2 className="text-xl font-bold text-center mb-1">Create Account</h2>
          {error && <p className="text-xs text-red-500 text-center font-medium bg-red-50 dark:bg-red-950/40 p-2 rounded-xl border border-red-200 dark:border-red-800">{error}</p>}
          <div>
            <label className="text-xs font-semibold text-neutral-500 block mb-1">Full Name</label>
            <input
              type="text"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-500 block mb-1">Username</label>
            <input
              type="text"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="johndoe"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-500 block mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="john@example.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-500 block mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-500 block mb-1">Confirm Password</label>
            <input
              type="password"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm transition shadow-md disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-xs text-center text-neutral-500 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-brand-500 hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
