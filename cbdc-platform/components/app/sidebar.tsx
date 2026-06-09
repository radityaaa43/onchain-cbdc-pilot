import Link from "next/link";
import { LayoutDashboard, Coins, Landmark, Gavel, ArrowLeftRight, Users, Wallet, ShieldCheck, FileText, Handshake, FileSignature, AlertTriangle, BarChart2, Network } from "lucide-react";

const OPERATOR_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/assets", label: "Assets", icon: Coins },
  { href: "/admin/cbdc", label: "CBDC", icon: Landmark },
  { href: "/admin/auction", label: "Auction", icon: Gavel },
  { href: "/admin/dvp", label: "DVP", icon: ArrowLeftRight },
  { href: "/admin/securities", label: "Securities", icon: Handshake },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/admin/corporate", label: "Corp Actions", icon: FileSignature },
  { href: "/admin/netting",            label: "Netting",      icon: Network },
  { href: "/admin/oracle",             label: "Oracle",       icon: BarChart2 },
  { href: "/admin/settlement-failure", label: "Settlements",  icon: AlertTriangle },
];

const PARTICIPANT_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/participant/wallet", label: "Wallet", icon: Wallet },
  { href: "/participant/holdings", label: "Holdings", icon: Landmark },
  { href: "/participant/dvp", label: "DVP", icon: ArrowLeftRight },
  { href: "/participant/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/participant/reports", label: "Reports", icon: FileText },
  { href: "/participant/repo", label: "Repo", icon: Handshake },
  { href: "/participant/lending", label: "Lending", icon: Handshake },
  { href: "/participant/pledge", label: "Pledge", icon: Handshake },
  { href: "/participant/custody", label: "Custody", icon: Handshake },
  { href: "/participant/settlement-failure", label: "Settlements", icon: AlertTriangle },
];

export function Sidebar({ role }: { role: string }) {
  const items = role === "operator" ? OPERATOR_NAV : PARTICIPANT_NAV;
  return (
    <nav aria-label="Primary navigation" className="w-60 shrink-0 border-r border-border bg-card/60 p-3 hidden md:flex md:flex-col">
      <div className="font-mono text-sm text-primary px-2 py-3 tracking-widest">CBDC · BOND</div>
      <ul className="space-y-1 flex-1">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
            >
              <it.icon className="size-4 shrink-0" aria-hidden="true" />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
