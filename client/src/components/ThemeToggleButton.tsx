import { useThemeStore } from "../store/themeStore";
import { Sun } from "lucide-react";

export default function ThemeToggleButton() {
  const { isRedTheme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-full shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
        isRedTheme
          ? "bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-300"
          : "bg-brand-500 text-white hover:bg-brand-600"
      }`}
      title={isRedTheme ? "Switch to Default UI" : "Switch to Red UI"}
    >
      <Sun className="w-4 h-4 text-amber-300" />
    </button>
  );
}
