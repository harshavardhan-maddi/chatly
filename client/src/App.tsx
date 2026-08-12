import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ChatRoom from "./pages/ChatRoom";
import { useAuthStore } from "./store/authStore";
import { api } from "./services/api";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const setUser = useAuthStore((s) => s.setUser);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/auth/me")
      .then((res) => {
        if (isMounted) setUser(res.data.user);
      })
      .catch(() => {
        if (isMounted && !user) setUser(null);
      })
      .finally(() => {
        if (isMounted) setInitializing(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-medium text-sm">Loading Chatly...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/home" replace /> : <Register />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/chats/:chatId"
        element={
          <RequireAuth>
            <ChatRoom />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={user ? "/home" : "/"} replace />} />
    </Routes>
  );
}
