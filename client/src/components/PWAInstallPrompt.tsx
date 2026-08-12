import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. Check if already installed as PWA standalone app or installed previously
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem("chatly_pwa_installed") === "true";

    const isDismissed = localStorage.getItem("chatly_pwa_dismissed") === "true";

    if (isStandalone || isDismissed) {
      return;
    }

    // 2. Listen for browser's beforeinstallprompt event
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    }

    // 3. Listen for appinstalled event
    function handleAppInstalled() {
      localStorage.setItem("chatly_pwa_installed", "true");
      setShowPrompt(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) {
      // Fallback for browsers that don't trigger beforeinstallprompt (e.g. iOS Safari)
      alert("To install Chatly on iOS: Tap the Share button in Safari, then select 'Add to Home Screen'.");
      localStorage.setItem("chatly_pwa_installed", "true");
      setShowPrompt(false);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      localStorage.setItem("chatly_pwa_installed", "true");
    } else {
      localStorage.setItem("chatly_pwa_dismissed", "true");
    }

    setShowPrompt(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem("chatly_pwa_dismissed", "true");
    setShowPrompt(false);
  }

  if (!showPrompt) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 bg-neutral-900 text-white p-4 rounded-2xl border border-neutral-800 shadow-2xl animate-bounce-short">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center font-bold text-white text-lg">
            C
          </div>
          <div>
            <h3 className="font-bold text-sm">Install Chatly App</h3>
            <p className="text-xs text-neutral-400">Add to home screen for fast mobile experience</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-neutral-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 font-medium text-xs text-white flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
        >
          <Download className="w-3.5 h-3.5" /> Install App
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 rounded-xl border border-neutral-700 text-xs text-neutral-300 font-medium hover:bg-neutral-800 transition"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
