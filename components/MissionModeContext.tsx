"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type MissionMode = "space" | "earth";

const MissionModeContext = createContext<{
  mode: MissionMode;
  setMode: (m: MissionMode) => void;
} | null>(null);

export function MissionModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<MissionMode>("space");
  return (
    <MissionModeContext.Provider value={{ mode, setMode }}>
      {children}
    </MissionModeContext.Provider>
  );
}

export function useMissionMode() {
  const ctx = useContext(MissionModeContext);
  if (!ctx) throw new Error("useMissionMode requires provider");
  return ctx;
}
