import { requirePermission } from "@/lib/rbac";
import Link from "next/link";

const TABS = [
  { href: "/admin/compliance/dfabi",   label: "DFABI" },
  { href: "/admin/compliance/aml",     label: "AML / KYC" },
  { href: "/admin/compliance/policy",  label: "Policy Engine" },
  { href: "/admin/compliance/shariah", label: "Shariah" },
  { href: "/admin/compliance/sar",     label: "SAR" },
];

export default async function CompliancePage() {
  await requirePermission("compliance.view");
  return (
    <section className="space-y-4">
      <h1 className="font-mono text-lg">Compliance Admin</h1>
      <nav className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">Select a compliance module above.</p>
    </section>
  );
}
