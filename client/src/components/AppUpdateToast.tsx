import { useAppUpdate } from "../context/AppUpdateContext";
import { Sparkles, RefreshCw, X } from "lucide-react";

export default function AppUpdateToast() {
  const {
    availableVersion,
    updateState,
    applyUpdate,
    dismissUpdate,
    isDismissed,
  } = useAppUpdate();

  if (updateState !== "UPDATE_AVAILABLE" && updateState !== "UPDATING") {
    return null;
  }

  if (isDismissed && updateState !== "UPDATING") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-slide-up">
      <div className="bg-neutral-900/95 dark:bg-neutral-900/95 text-white p-4 rounded-2xl shadow-2xl border border-neutral-700/80 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                New version available
                {availableVersion && (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-brand-500/20 text-cyan-300 border border-cyan-500/30">
                    {availableVersion}
                  </span>
                )}
              </h4>
            </div>
          </div>
          <button
            onClick={dismissUpdate}
            className="p-1 text-neutral-400 hover:text-white rounded-full transition"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed mb-4">
          A new update is available. Click below to upgrade Chatly with the latest performance and features.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={dismissUpdate}
            disabled={updateState === "UPDATING"}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
          >
            Later
          </button>
          <button
            onClick={applyUpdate}
            disabled={updateState === "UPDATING"}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md active:scale-95 transition disabled:opacity-60 cursor-pointer"
          >
            {updateState === "UPDATING" ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating…
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" /> Update Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
