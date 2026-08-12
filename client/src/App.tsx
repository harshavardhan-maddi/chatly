import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ChatRoom from "./pages/ChatRoom";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { useAuthStore } from "./store/authStore";
import { api } from "./services/api";
import { getSocket } from "./services/socket";
import { registerGlobalPushSubscription, triggerAppNotification } from "./services/pushManager";

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
    const safetyTimer = setTimeout(() => {
      if (isMounted) setInitializing(false);
    }, 1200);

    api
      .get("/auth/me")
      .then((res) => {
        if (isMounted) setUser(res.data.user);
      })
      .catch(() => {
        if (isMounted && !user) setUser(null);
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setInitializing(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Global Push Subscription & Socket Notification Listener
  useEffect(() => {
    if (!user) return;

    // Register VAPID Web Push Subscription in database globally as soon as user logs in!
    registerGlobalPushSubscription();

    const socket = getSocket();

    function onGlobalNotification(data: { chatId: string; message: any; chatName?: string }) {
      if (data.message?.senderId !== user?.id) {
        triggerAppNotification(
          "New Notification",
          `Message from ${data.chatName || "Chatly"}`,
          `/chats/${data.chatId}`
        );
      }
    }

    socket.on("notification:new", onGlobalNotification);

    return () => {
      socket.off("notification:new", onGlobalNotification);
    };
  }, [user]);

  if (initializing) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-medium text-sm">Loading Chatly Mobile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center sm:py-4">
      {/* Mobile Shell Frame */}
      <div className="w-full sm:max-w-md h-full sm:h-[844px] bg-white dark:bg-neutral-950 sm:rounded-[40px] sm:shadow-2xl overflow-hidden flex flex-col relative sm:border-[8px] sm:border-neutral-800">
        <Routes>
          <Route path="/" element={<Landing />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* PWA Install App Popup */}
        <PWAInstallPrompt />
      </div>
    </div>
  );
}
