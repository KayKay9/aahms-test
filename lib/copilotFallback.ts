import { riskLabel, type RiskLevel } from "@/lib/risk";

export type CopilotContext = {
  userName: string;
  vitalsSummary: string;
  risk: RiskLevel;
  pvtSummary: string;
  webLlmReady: boolean;
};

/** On-device rules when WebLLM is loading or WebGPU is unavailable (demo-safe triage text). */
export function generateCopilotFallback(
  userMessage: string,
  ctx: CopilotContext
): string {
  const q = userMessage.toLowerCase();
  const prefix = ctx.webLlmReady
    ? ""
    : "[Edge triage engine — WebLLM still loading or unavailable] ";

  if (/dizz|vertigo|lightheaded|feel dizzy/.test(q)) {
    return (
      prefix +
      `${ctx.userName}, dizziness with current vitals (${ctx.vitalsSummary}) is often linked to fluid shift, dehydration, or orthostatic change in microgravity. Sit, secure restraint, check SpO₂ and HR for 5 min. Hydrate per protocol; avoid sudden head movement. Risk tier: ${riskLabel(ctx.risk)}. If syncope, vomiting, or neuro deficits → escalate to CDR and ground surgeon. ${ctx.pvtSummary}.`
    );
  }

  if (/headache|head ache|migraine/.test(q)) {
    return (
      prefix +
      `Headache report logged for ${ctx.userName}. Correlate with ppCO₂, hydration, and sleep debt; review cabin atmosphere. Current vitals: ${ctx.vitalsSummary}. Consider analgesia per formulary if no red flags (focal neuro, worst-ever, fever). Monitor 30 min; ${ctx.pvtSummary}. Risk: ${riskLabel(ctx.risk)}.`
    );
  }

  if (/chest|heart|palpitation|arrhythm/.test(q)) {
    return (
      prefix +
      `Cardiac symptom flagged. HR context: ${ctx.vitalsSummary}. Obtain rhythm strip if available; hold strenuous activity. If HR sustained >120, SpO₂ <92%, or chest pain radiating → emergency protocol. Otherwise continue telemetry and voice check-in.`
    );
  }

  if (/nausea|vomit|sick/.test(q)) {
    return (
      prefix +
      `GI symptom — assess hydration, last meal, and motion. Anti-emetic per CMO protocol if no bowel obstruction signs. Vitals: ${ctx.vitalsSummary}.`
    );
  }

  if (/emergency|help|urgent|sos/.test(q)) {
    return (
      prefix +
      `Acknowledged urgency for ${ctx.userName}. Vitals: ${ctx.vitalsSummary}; risk ${riskLabel(ctx.risk)}. Notify CDR, begin time-stamped log, prepare for ground consult when link available.`
    );
  }

  return (
    prefix +
    `Flight Surgeon Co-Pilot (${ctx.userName}): vitals ${ctx.vitalsSummary}; assessment ${riskLabel(ctx.risk)}. ${ctx.pvtSummary}. For your question — maintain hydration, sleep hygiene, and exercise quota; recheck vitals in 15 min. Full LLM inference ${ctx.webLlmReady ? "available" : "pending — enable WebGPU in Chrome/Edge and wait for model download (~hundreds MB first run)"}.`
  );
}
