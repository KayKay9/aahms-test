import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assessRisk, type RiskLevel } from "@/lib/risk";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: session.role === "COMMANDER" ? { role: "ASTRONAUT" } : { crewId: session.crewId },
    orderBy: [{ crewId: "asc" }, { name: "asc" }],
  });

  const userIds = users.map((u) => u.id);
  const records = await prisma.biometricRecord.findMany({
    where: { userId: { in: userIds } },
    orderBy: { timestamp: "desc" },
  });

  const latestByUser = new Map<string, (typeof records)[0]>();
  for (const r of records) {
    if (!latestByUser.has(r.userId)) latestByUser.set(r.userId, r);
  }

  const crewMap = new Map<
    string,
    Array<{
      user: {
        id: string;
        name: string;
        email: string;
        callsign: string;
        crewId: string;
      };
      latest: (typeof records)[0] | null;
      risk: RiskLevel;
    }>
  >();

  for (const u of users) {
    const latest = latestByUser.get(u.id) ?? null;
    const risk = latest
      ? assessRisk({
          heartRate: latest.heartRate,
          hrv: latest.hrv,
          spo2: latest.spo2,
          radiation: latest.radiation,
        })
      : "GREEN";

    const list = crewMap.get(u.crewId) ?? [];
    list.push({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        callsign: u.callsign,
        crewId: u.crewId,
      },
      latest,
      risk,
    });
    crewMap.set(u.crewId, list);
  }

  const crews = Array.from(crewMap.entries()).map(([crewId, members]) => ({
    crewId,
    members,
  }));

  const lastRecord = records[0];
  return NextResponse.json({
    syncStatus: {
      lastSyncAt: lastRecord?.timestamp.toISOString() ?? null,
      pendingEstimate: 0,
    },
    crews,
  });
}
