import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  profileImage?: string | null;
  bio?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  initializing: boolean;
  setUser: (user: AuthUser | null) => void;
  setInitializing: (initializing: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      initializing: true,
      setUser: (user) => set({ user, initializing: false }),
      setInitializing: (initializing) => set({ initializing }),
    }),
    {
      name: "chatly-auth-user",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
