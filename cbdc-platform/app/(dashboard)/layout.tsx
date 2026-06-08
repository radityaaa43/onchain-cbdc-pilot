import { Sidebar } from "@/components/app/sidebar";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getSession();
  } catch {
    redirect("/login");
  }
  return (
    <div className="flex min-h-dvh">
      <Sidebar role={env.APP_ROLE} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{env.APP_ROLE.toUpperCase()}</span>
          <span className="text-sm text-foreground">{user!.name} · {user!.orgType}</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
