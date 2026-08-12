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
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center mb-6">Log in to Chatly</h1>
        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800">{error}</p>}
        <input
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-full bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition text-white font-medium disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
        <p className="text-center text-sm text-neutral-500">
          Don't have an account? <Link to="/register" className="text-brand-500 font-medium hover:underline">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
