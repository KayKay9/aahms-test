import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "aahms2025";

type SeedUser = {
  name: string;
  email: string;
  role: Role;
  callsign: string;
  crewId: string;
  vitals?: { heartRate: number; hrv: number; spo2: number; radiation: number };
};

const users: SeedUser[] = [
  {
    name: "Ground Control",
    email: "ground@aahms.demo",
    role: Role.COMMANDER,
    callsign: "FLIGHT",
    crewId: "HQ",
  },
  {
    name: "Vance",
    email: "vance@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "CDR",
    crewId: "MTV-1",
    vitals: { heartRate: 64, hrv: 71, spo2: 98, radiation: 0.021 },
  },
  {
    name: "John",
    email: "john@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "EV1",
    crewId: "MTV-1",
    vitals: { heartRate: 78, hrv: 62, spo2: 98, radiation: 0.021 },
  },
  {
    name: "Cho",
    email: "cho@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "FE",
    crewId: "MTV-1",
    vitals: { heartRate: 70, hrv: 58, spo2: 97, radiation: 0.021 },
  },
  {
    name: "Silva",
    email: "silva@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "CMO",
    crewId: "MTV-1",
    vitals: { heartRate: 61, hrv: 80, spo2: 99, radiation: 0.021 },
  },
  {
    name: "Reyes",
    email: "reyes@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "EV2",
    crewId: "MTV-2",
    vitals: { heartRate: 72, hrv: 55, spo2: 97, radiation: 0.019 },
  },
  {
    name: "Park",
    email: "park@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "MS1",
    crewId: "MTV-2",
    vitals: { heartRate: 68, hrv: 63, spo2: 98, radiation: 0.02 },
  },
  {
    name: "Okonkwo",
    email: "okonkwo@aahms.demo",
    role: Role.ASTRONAUT,
    callsign: "MS2",
    crewId: "MTV-2",
    vitals: { heartRate: 75, hrv: 49, spo2: 96, radiation: 0.022 },
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        password: passwordHash,
        role: u.role,
        callsign: u.callsign,
        crewId: u.crewId,
      },
      create: {
        name: u.name,
        email: u.email,
        password: passwordHash,
        role: u.role,
        callsign: u.callsign,
        crewId: u.crewId,
      },
    });

    if (u.vitals) {
      const existing = await prisma.biometricRecord.findFirst({
        where: { userId: user.id },
      });
      if (!existing) {
        const now = new Date();
        for (let i = 0; i < 12; i++) {
          await prisma.biometricRecord.create({
            data: {
              id: `seed-${user.id}-${i}`,
              userId: user.id,
              heartRate: u.vitals.heartRate + Math.floor(Math.random() * 6 - 3),
              hrv: u.vitals.hrv + Math.random() * 4 - 2,
              spo2: u.vitals.spo2,
              radiation: u.vitals.radiation,
              synced: true,
              timestamp: new Date(now.getTime() - i * 3600_000),
            },
          });
        }
      }
    }
  }

  console.log("Seed complete. Demo password for all users:", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
