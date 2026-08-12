import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    // Check if already opened in standalone mode (already launched as installed PWA app)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Capture browser beforeinstallprompt event
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    }

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
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("chatly_pwa_installed", "true");
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Mobile Safari (iOS) and Android Chrome Fallback instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert("To install Chatly App on iPhone/iPad:\n\n1. Tap the Share button at the bottom of Safari.\n2. Tap 'Add to Home Screen'.");
      } else {
        alert("To install Chatly App on Android:\n\n1. Tap the 3 dots menu at top right of Chrome.\n2. Tap 'Install App' or 'Add to Home screen'.");
      }
      localStorage.setItem("chatly_pwa_installed", "true");
      setShowPrompt(false);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
  }

  if (!showPrompt) return null;

  return (
    <div className="absolute top-2 left-2 right-2 z-[9999] bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 text-white p-3.5 rounded-2xl border border-neutral-800 shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-lg shadow-md">
            C
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight text-white">Install Chatly App</h3>
            <p className="text-[11px] text-neutral-400">Install for best mobile experience & quick access</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 font-semibold text-xs text-white flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
        >
          <Download className="w-4 h-4" /> Install App
        </button>
        <button
          onClick={handleDismiss}
          className="px-3.5 py-2 rounded-xl border border-neutral-800 text-xs text-neutral-400 font-medium hover:bg-neutral-800 transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
