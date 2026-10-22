import Dexie, { type Table } from "dexie";

export interface VitalRecord {
  id: string;
  userId: string;
  heartRate: number;
  hrv: number;
  spo2: number;
  radiation: number;
  synced: boolean;
  timestamp: number;
}

export class AAHMSDatabase extends Dexie {
  vitals!: Table<VitalRecord, string>;

  constructor() {
    super("aahms_vitals");
    this.version(1).stores({
      vitals: "id, userId, synced, timestamp",
    });
  }
}

export const db = new AAHMSDatabase();

export async function addVital(
  record: Omit<VitalRecord, "synced"> & { synced?: boolean }
): Promise<void> {
  await db.vitals.put({
    ...record,
    synced: record.synced ?? false,
  });
}

export async function getUnsyncedVitals(): Promise<VitalRecord[]> {
  return db.vitals.filter((r) => !r.synced).toArray();
}

export async function markSynced(ids: string[]): Promise<void> {
  await db.transaction("rw", db.vitals, async () => {
    for (const id of ids) {
      const row = await db.vitals.get(id);
      if (row) await db.vitals.put({ ...row, synced: true });
    }
  });
}

export async function getLatestForUser(
  userId: string
): Promise<VitalRecord | undefined> {
  return db.vitals
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("timestamp")
    .then((rows) => rows[0]);
}

export async function getRecentForUser(
  userId: string,
  limit: number
): Promise<VitalRecord[]> {
  const rows = await db.vitals
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("timestamp");
  return rows.slice(0, limit);
}

export async function getAllVitals(): Promise<VitalRecord[]> {
  return db.vitals.orderBy("timestamp").reverse().toArray();
}

export async function countUnsynced(): Promise<number> {
  return db.vitals.filter((r) => !r.synced).count();
}
