import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, createSessionToken, type SessionUser } from "@/lib/auth";

const DEMO_EMAIL = "john@aahms.demo";

/** Any email/password signs in. On by default outside production; set DEMO_MODE=false to disable. */
function isDemoMode() {
  if (process.env.DEMO_MODE) return process.env.DEMO_MODE === "true";
  return process.env.NODE_ENV !== "production";
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim() || "Guest";
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function demoSignIn(email: string, password: string): Promise<SessionUser> {
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email,
          name: nameFromEmail(email),
          password: await bcrypt.hash(password || "demo", 10),
          role: "ASTRONAUT",
          callsign: "GUEST",
          crewId: "MTV-1",
        },
      }));
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      crewId: user.crewId,
      callsign: user.callsign,
    };
  } catch (err) {
    // Database unreachable or not migrated yet: still let the demo in with a stable offline identity.
    console.warn("Demo sign-in without database:", err instanceof Error ? err.message.split("\n").pop() : err);
    return {
      userId: `demo-${createHash("sha256").update(email).digest("hex").slice(0, 16)}`,
      name: nameFromEmail(email),
      email,
      role: "ASTRONAUT",
      crewId: "MTV-1",
      callsign: "GUEST",
    };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const demo = isDemoMode();
  const email = String(body.demo ? DEMO_EMAIL : (body.email ?? "")).toLowerCase().trim();
  const password = String(body.password ?? "");

  let sessionUser: SessionUser;

  if (demo) {
    sessionUser = await demoSignIn(email || DEMO_EMAIL, password);
  } else {
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    sessionUser = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      crewId: user.crewId,
      callsign: user.callsign,
    };
  }

  const token = await createSessionToken(sessionUser);
  const response = NextResponse.json({ user: sessionUser });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
