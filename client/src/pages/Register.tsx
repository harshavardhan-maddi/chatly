import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

export default function Register() {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUser(data.user);
      navigate("/home");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center mb-6">Create your Chatly account</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {(["name", "username", "email"] as const).map((field) => (
          <input
            key={field}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent"
            placeholder={field[0].toUpperCase() + field.slice(1)}
            value={form[field]}
            onChange={(e) => update(field, e.target.value)}
            required
          />
        ))}
        <input
          type="password"
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent"
          placeholder="Password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-transparent"
          placeholder="Confirm password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="w-full py-3 rounded-full bg-brand-500 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
        <p className="text-center text-sm text-neutral-500">
          Already have an account? <Link to="/login" className="text-brand-500 font-medium">Log in</Link>
        </p>
      </form>
    </div>
  );
}
