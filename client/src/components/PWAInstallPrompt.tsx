import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    // Hide ONLY when actively launched inside the installed PWA standalone window
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Always show top drop-down card when opened in browser tab
    setShowPrompt(true);

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    }

    function handleAppInstalled() {
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
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === "accepted") {
          setShowPrompt(false);
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.error("Direct install error:", err);
      }
    }

    // Direct instructions for mobile browsers
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      alert("To Install Chatly App on iPhone / iPad:\n\n1. Tap the Share icon (bottom of Safari).\n2. Tap 'Add to Home Screen'.");
    } else {
      alert("To Install Chatly App on Mobile Chrome / Android:\n\n1. Tap the 3 dots menu (⋮) at top right.\n2. Tap 'Add to Home Screen' or 'Install App'.");
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
  }

  if (!showPrompt) return null;

  return (
    <div className="absolute top-2 left-2 right-2 z-[99999] bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 text-white p-3.5 rounded-2xl border-2 border-brand-500/40 shadow-2xl transition-all duration-300 transform translate-y-0 animate-bounce-short">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-lg shadow-lg ring-2 ring-brand-500/30">
            C
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-400" /> Install Chatly App
            </h3>
            <p className="text-[11px] text-neutral-300">Tap below to install full mobile app to device</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-neutral-400 hover:text-white p-1.5 rounded-full hover:bg-neutral-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-2.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 font-bold text-xs text-white flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-lg animate-pulse"
        >
          <Download className="w-4 h-4" /> INSTALL APP NOW
        </button>
        <button
          onClick={handleDismiss}
          className="px-3.5 py-2.5 rounded-xl border border-neutral-800 text-xs text-neutral-400 font-medium hover:bg-neutral-800 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
