"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  speechErrorMessage,
  type SpeechListenStatus,
} from "@/lib/speechRecognition";

export function useVoiceCheckIn(onFinalTranscript: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [status, setStatus] = useState<SpeechListenStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supported = isSpeechRecognitionSupported();

  const stop = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setStatus("idle");
    setInterim("");
  }, []);

  const start = useCallback(() => {
    setError(null);
    setInterim("");
    recognitionRef.current?.abort();

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError(
        "Speech recognition is not supported in this browser. Use Chrome or Edge."
      );
      setStatus("error");
      return;
    }

    recognitionRef.current = recognition;

    recognition.onstart = () => setStatus("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        onFinalTranscript(finalText.trim());
        setInterim("");
        setStatus("idle");
        recognition.stop();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        setError(speechErrorMessage(event.error));
        setStatus("error");
      }
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setError("Could not start microphone. Try again.");
      setStatus("error");
      recognitionRef.current = null;
    }
  }, [onFinalTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const runPromptFallback = useCallback(() => {
    const text = window.prompt("Voice check-in (type if mic unavailable):", "");
    if (text?.trim()) onFinalTranscript(text.trim());
  }, [onFinalTranscript]);

  return {
    supported,
    status,
    interim,
    error,
    start,
    stop,
    runPromptFallback,
    isListening: status === "listening",
  };
}
