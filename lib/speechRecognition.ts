/** Web Speech API (Chrome / Edge). Not available in all browsers. */

export type SpeechListenStatus = "idle" | "listening" | "processing" | "error";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (!isSpeechRecognitionSupported()) return null;
  const Ctor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function speechErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
      return "Microphone permission denied. Allow mic access for this site.";
    case "no-speech":
      return "No speech detected. Try again and speak clearly.";
    case "audio-capture":
      return "No microphone found or capture failed.";
    case "network":
      return "Speech recognition needs network (browser STT service).";
    case "aborted":
      return "Listening stopped.";
    default:
      return `Speech error: ${error}`;
  }
}
