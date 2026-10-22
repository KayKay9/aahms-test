"use client";

import { useEffect } from "react";
import { useSync } from "./SyncContext";

/** Background sync worker — mounts once; UI lives in OfflineAICopilot / header */
export function SyncEngine() {
  const { isOnline, syncNow, refreshCount } = useSync();

  useEffect(() => {
    if (isOnline) void syncNow();
  }, [isOnline, syncNow]);

  useEffect(() => {
    const id = setInterval(() => void refreshCount(), 5000);
    return () => clearInterval(id);
  }, [refreshCount]);

  return null;
}
