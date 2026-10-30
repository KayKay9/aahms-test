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
  // Only the newest record per crew member is needed. Fetching the whole history
  // (thousands of rows once vitals have been syncing a while) made this route take
  // 5-10 s; one indexed (userId, timestamp) lookup per user runs in parallel instead.
  const records = (
    await Promise.all(
      userIds.map((userId) =>
        prisma.biometricRecord.findFirst({
          where: { userId },
          orderBy: { timestamp: "desc" },
        })
      )
    )
  )
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Each person's own normal: the average of their previous readings (excluding the
  // newest), so the co-pilot can say "128 bpm, well above Cho's usual 72".
  const baselines = new Map(
    await Promise.all(
      userIds.map(async (userId) => {
        const agg = await prisma.biometricRecord.aggregate({
          where: { userId },
          orderBy: { timestamp: "desc" },
          skip: 1,
          take: 300,
          _avg: { heartRate: true, hrv: true, spo2: true },
          _count: true,
        });
        return [
          userId,
          agg._count >= 5
            ? { heartRate: agg._avg.heartRate, hrv: agg._avg.hrv, spo2: agg._avg.spo2, samples: agg._count }
            : null,
        ] as const;
      })
    )
  );

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
      baseline: ReturnType<typeof baselines.get> | null;
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
      baseline: baselines.get(u.id) ?? null,
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
