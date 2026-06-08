import { redirect } from "next/navigation";

// Root page served by app/page.tsx — (dashboard) layout wraps /admin/* and /participant/*
export default function DashboardGroupPage() {
  redirect("/");
}
