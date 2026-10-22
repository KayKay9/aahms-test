"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  countUnsynced,
  getUnsyncedVitals,
  markSynced,
} from "@/lib/db";

type SyncContextValue = {
  isOnline: boolean;
  unsyncedCount: number;
  lastSyncAt: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  syncNow: () => Promise<void>;
  refreshCount: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    setUnsyncedCount(await countUnsynced());
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncError("Offline — store-and-forward queue active");
      return;
    }
    setIsSyncing(true);
    setSyncError(null);
    try {
      const records = await getUnsyncedVitals();
      if (records.length === 0) {
        setLastSyncAt(new Date());
        await refreshCount();
        return;
      }
      const res = await fetch("/api/biometrics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Sync failed");
      }
      const data = await res.json();
      await markSynced(data.synced ?? records.map((r) => r.id));
      setLastSyncAt(new Date());
      await refreshCount();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    refreshCount();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => {
      void syncNow();
    }, 30_000);
    return () => clearInterval(id);
  }, [isOnline, syncNow]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        unsyncedCount,
        lastSyncAt,
        isSyncing,
        syncError,
        syncNow,
        refreshCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync requires SyncProvider");
  return ctx;
}
