import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

/** Runs WebLLM off the main thread so weight loading and shader compile never freeze the console UI. */
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
