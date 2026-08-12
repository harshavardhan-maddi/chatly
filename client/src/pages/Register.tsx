import { FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

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
      setError(err.response?.data?.error ?? "Failed to create account. Please check your details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center mb-6">Create your Chatly account</h1>
        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800">
            {error}
          </p>
        )}
        <input
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Full Name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />
        <input
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Username (e.g. alex_dev)"
          value={form.username}
          onChange={(e) => update("username", e.target.value.toLowerCase().trim())}
          required
        />
        <input
          type="email"
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => update("email", e.target.value.trim())}
          required
        />
        <input
          type="password"
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Password (min 6 chars)"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Confirm password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-full bg-brand-500 hover:bg-brand-600 active:scale-[0.99] transition text-white font-medium disabled:opacity-60 cursor-pointer shadow-sm"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
        <p className="text-center text-sm text-neutral-500">
          Already have an account? <Link to="/login" className="text-brand-500 font-medium hover:underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
