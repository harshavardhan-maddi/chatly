import { create } from "zustand";

interface ThemeState {
  isRedTheme: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isRedTheme: typeof window !== "undefined" && localStorage.getItem("chatly_theme_red") === "true",
  toggleTheme: () =>
    set((state) => {
      const next = !state.isRedTheme;
      localStorage.setItem("chatly_theme_red", String(next));
      if (typeof document !== "undefined") {
        if (next) {
          document.documentElement.classList.add("theme-red");
        } else {
          document.documentElement.classList.remove("theme-red");
        }
      }
      return { isRedTheme: next };
    }),
}));

if (typeof window !== "undefined" && localStorage.getItem("chatly_theme_red") === "true") {
  document.documentElement.classList.add("theme-red");
}
