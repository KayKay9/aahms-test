/**
 * Fictional medical profiles for the demo crew, keyed by crew name. Gives the co-pilot
 * what a flight surgeon would know about each person (role, history, allergies,
 * regular medication) so it can answer "can Cho take ibuprofen?" or "who is our medic?".
 */

export type CrewProfile = {
  role: string;
  age: number;
  bloodType: string;
  allergies: string;
  medications: string;
  notes: string;
};

export const CREW_PROFILES: Record<string, CrewProfile> = {
  Vance: {
    role: "Commander (CDR), MTV-1",
    age: 47,
    bloodType: "O+",
    allergies: "none known",
    medications: "none",
    notes: "Former test pilot. Makes the final call on crew medical actions on MTV-1.",
  },
  John: {
    role: "EVA crew member 1 (EV1), MTV-1",
    age: 38,
    bloodType: "A+",
    allergies: "penicillin (rash)",
    medications: "none",
    notes: "Lead spacewalker. History of mild space motion sickness in the first week of flight.",
  },
  Cho: {
    role: "Flight engineer (FE), MTV-1",
    age: 35,
    bloodType: "B+",
    allergies: "ibuprofen and other NSAIDs (wheezing)",
    medications: "none",
    notes: "Mild exercise-induced asthma as a child, no symptoms in recent years. Use acetaminophen, not ibuprofen, for pain.",
  },
  Silva: {
    role: "Crew medical officer (CMO), MTV-1",
    age: 42,
    bloodType: "AB+",
    allergies: "none known",
    medications: "none",
    notes: "Physician and the onboard medic. Administers medications and procedures for both crews.",
  },
  Reyes: {
    role: "EVA crew member 2 (EV2), MTV-2",
    age: 40,
    bloodType: "O-",
    allergies: "none known",
    medications: "melatonin 3 mg at bedtime as needed",
    notes: "Universal blood donor. Occasional trouble sleeping on shifted schedules.",
  },
  Park: {
    role: "Mission specialist 1 (MS1), MTV-2",
    age: 33,
    bloodType: "A-",
    allergies: "shellfish",
    medications: "none",
    notes: "Youngest crew member, excellent fitness scores.",
  },
  Okonkwo: {
    role: "Mission specialist 2 (MS2), MTV-2",
    age: 44,
    bloodType: "B-",
    allergies: "sulfa drugs",
    medications: "none",
    notes: "Radiation physicist; runs the dosimetry and storm shelter procedures. Works long hours in the lab module, which has lighter shielding.",
  },
};

export function describeProfile(name: string): string | null {
  const p = CREW_PROFILES[name];
  if (!p) return null;
  return `${name}: ${p.role}, age ${p.age}, blood ${p.bloodType}. Allergies: ${p.allergies}. Medications: ${p.medications}. ${p.notes}`;
}
