import { useThemeStore } from "../store/themeStore";
import { Palette } from "lucide-react";

export default function ThemeToggleButton() {
  const { isRedTheme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
        isRedTheme
          ? "bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-300"
          : "bg-brand-500 text-white hover:bg-brand-600"
      }`}
      title="Toggle UI Color (Default vs Red Theme)"
    >
      <Palette className="w-3.5 h-3.5" />
      <span>{isRedTheme ? "Red Theme" : "Default UI"}</span>
    </button>
  );
}
