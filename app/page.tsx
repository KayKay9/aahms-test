import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SuperAdminDashboard } from "@/components/SuperAdminDashboard";

async function ConsoleGate() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <SuperAdminDashboard user={session} />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-cyan-400">
          Loading mission console…
        </div>
      }
    >
      <ConsoleGate />
    </Suspense>
  );
}
