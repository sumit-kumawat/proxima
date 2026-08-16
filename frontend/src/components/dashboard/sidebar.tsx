"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, MonitorPlay, Package, Ticket, Users, Settings, BookOpen, Activity, ScrollText, Scale, TriangleAlert } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/vms", label: "Virtual Machines", icon: MonitorPlay, exact: false },
  { href: "/templates", label: "Template Store", icon: Package, exact: false },
  { href: "/help", label: "Help & Docs", icon: BookOpen, exact: false },
];

const ADMIN_NAV = [
  { href: "/admin/monitor", label: "Monitor", icon: Activity },
  { href: "/admin/balancer", label: "Balancer", icon: Scale },
  { href: "/admin/invites", label: "Invites", icon: Ticket },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings, isWarning: true },
];

/**
 * The shared sidebar contents (brand header + nav), used by both the desktop
 * `Sidebar` and the mobile drawer (`MobileSidebar`) so the two never drift.
 */
export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [showSettingsWarning, setShowSettingsWarning] = useState(false);

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <div className="flex h-16 items-center border-b border-border px-4 py-2 shrink-0">
        <BrandLogo showText={false} imageClassName="h-9 max-h-11" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV.map((item) => (
          <SidebarLink key={item.href} {...item} active={isActive(item.href, item.exact)} />
        ))}

        {role === "admin" && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</div>
            {ADMIN_NAV.map((item) => (
              <SidebarLink
                key={item.href}
                {...item}
                active={isActive(item.href, false)}
                onClick={
                  item.isWarning
                    ? (e) => {
                        e.preventDefault();
                        setShowSettingsWarning(true);
                      }
                    : undefined
                }
              />
            ))}
          </>
        )}
      </nav>

      {/* Admin Settings Warning Alert Modal */}
      <AlertDialog open={showSettingsWarning} onOpenChange={setShowSettingsWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-5 shrink-0" />
              Admin Settings Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm pt-2">
              You are accessing core system settings. Modifying Proxmox cluster parameters, storage pools, or API keys impacts live operations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setShowSettingsWarning(false);
                router.push("/admin/settings");
              }}
            >
              Proceed to Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex h-screen sticky top-0">
      <SidebarNav />
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
