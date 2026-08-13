import React, { createContext, useContext, useEffect, useState } from "react";

export type UpdateState =
  | "CURRENT"
  | "CHECKING"
  | "UPDATE_AVAILABLE"
  | "UPDATING"
  | "UPDATED"
  | "ERROR";

export interface AppUpdateContextType {
  currentVersion: string;
  currentBuildTime: string;
  availableVersion: string | null;
  availableBuildTime: string | null;
  updateState: UpdateState;
  lastCheckedAt: Date | null;
  checkForUpdates: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  isDismissed: boolean;
}

const AppUpdateContext = createContext<AppUpdateContextType | undefined>(undefined);

export function AppUpdateProvider({ children }: { children: React.ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState<string>(() => {
    return localStorage.getItem("chatly_current_version") || "unknown";
  });
  const [currentBuildTime, setCurrentBuildTime] = useState<string>("");

  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [availableBuildTime, setAvailableBuildTime] = useState<string | null>(null);

  const [updateState, setUpdateState] = useState<UpdateState>("CHECKING");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  async function fetchServerVersion(): Promise<{ version: string; buildTime: string } | null> {
    try {
      const res = await fetch(`/version.json?check=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function checkForUpdates() {
    setLastCheckedAt(new Date());
    const data = await fetchServerVersion();

    if (!data || !data.version) {
      if (updateState === "CHECKING") setUpdateState("CURRENT");
      return;
    }

    // If initial boot when currentVersion is unknown, adopt the server version
    if (currentVersion === "unknown") {
      setCurrentVersion(data.version);
      setCurrentBuildTime(data.buildTime);
      localStorage.setItem("chatly_current_version", data.version);
      setUpdateState("CURRENT");
      return;
    }

    // Compare server version against running currentVersion
    if (data.version !== currentVersion) {
      setAvailableVersion(data.version);
      setAvailableBuildTime(data.buildTime);
      setUpdateState("UPDATE_AVAILABLE");

      // Also trigger Service Worker registration update check
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(() => {});
        });
      }
    } else {
      setAvailableVersion(null);
      setAvailableBuildTime(null);
      setUpdateState("CURRENT");
    }
  }

  async function applyUpdate() {
    setUpdateState("UPDATING");

    try {
      // 1. Post SKIP_WAITING to waiting Service Worker if available
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      }

      // 2. Clear browser CacheStorage
      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 3. Update currentVersion in localStorage
      if (availableVersion) {
        localStorage.setItem("chatly_current_version", availableVersion);
      }

      // 4. Reload page once to activate latest version
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (err) {
      console.error("Failed to apply update:", err);
      window.location.reload();
    }
  }

  function dismissUpdate() {
    if (availableVersion) {
      setDismissedVersion(availableVersion);
    }
  }

  // Check for updates on mount, intervals (5 mins), visibility, focus, and online events
  useEffect(() => {
    checkForUpdates();

    // 5-minute periodic check (300,000ms)
    const interval = setInterval(checkForUpdates, 300000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkForUpdates();
      }
    }
    function onFocus() {
      checkForUpdates();
    }
    function onOnline() {
      checkForUpdates();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [currentVersion]);

  const isDismissed = Boolean(availableVersion && dismissedVersion === availableVersion);

  return (
    <AppUpdateContext.Provider
      value={{
        currentVersion,
        currentBuildTime,
        availableVersion,
        availableBuildTime,
        updateState,
        lastCheckedAt,
        checkForUpdates,
        applyUpdate,
        dismissUpdate,
        isDismissed,
      }}
    >
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate() {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error("useAppUpdate must be used within an AppUpdateProvider");
  }
  return context;
}
