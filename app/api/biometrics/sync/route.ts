import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { VitalRecord } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const records = (body.records ?? []) as VitalRecord[];

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ synced: [] });
  }

  const owned = records.filter((r) => r.userId === session.userId);
  if (session.role !== "COMMANDER" && owned.length !== records.length) {
    return NextResponse.json({ error: "Cannot sync other users' records" }, { status: 403 });
  }

  const toSync = session.role === "COMMANDER" ? records : owned;

  await prisma.biometricRecord.createMany({
    data: toSync.map((r) => ({
      id: r.id,
      userId: r.userId,
      heartRate: r.heartRate,
      hrv: r.hrv,
      spo2: r.spo2,
      radiation: r.radiation,
      synced: true,
      timestamp: new Date(r.timestamp),
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ synced: toSync.map((r) => r.id) });
}
