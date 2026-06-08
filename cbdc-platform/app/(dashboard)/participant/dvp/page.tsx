import { requirePermission, can } from "@/lib/rbac";
import { DvpInbox } from "./dvp-inbox";

export default async function ParticipantDvpPage() {
  const user = await requirePermission("dvp.view");
  return (
    <section className="space-y-6">
      <h1 className="font-mono text-lg">DVP</h1>
      <DvpInbox canInitiate={can(user.roles, "dvp.initiate")} />
    </section>
  );
}
