import { requirePermission } from "@/lib/rbac";
import { RepoView } from "./repo-view";

export default async function RepoPage() {
  await requirePermission("repo.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Repo</h1>
      <RepoView />
    </section>
  );
}
