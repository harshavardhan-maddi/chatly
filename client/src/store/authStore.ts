import { create } from "zustand";

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  setUser: (user) => set({ user, initializing: false }),
  setInitializing: (initializing) => set({ initializing }),
}));
