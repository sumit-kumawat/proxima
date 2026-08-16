"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ChevronDown, ShieldCheck, Search, MonitorPlay, Package, Users, Settings, Activity, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { VirtualMachine, Template } from "@/lib/types";
import { formatOsName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface SearchItem {
  id: string;
  type: "vm" | "template" | "action";
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

function GlobalSearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [vms, setVms] = useState<VirtualMachine[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch search targets
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<VirtualMachine[]>("/vms").catch(() => ({ data: [] })),
      api.get<Template[]>("/templates").catch(() => ({ data: [] })),
    ]).then(([vRes, tRes]) => {
      if (active) {
        setVms(vRes.data || []);
        setTemplates(tRes.data || []);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useState<SearchItem[]>(() => [])[0];
  const searchResults: SearchItem[] = [];

  const q = query.trim().toLowerCase();
  if (q.length > 0) {
    // Search VMs
    vms.forEach((v) => {
      if (
        v.name.toLowerCase().includes(q) ||
        (v.ipAddress && v.ipAddress.includes(q)) ||
        (v.os && v.os.toLowerCase().includes(q)) ||
        v.status.toLowerCase().includes(q)
      ) {
        searchResults.push({
          id: `vm-${v.id}`,
          type: "vm",
          title: v.name,
          subtitle: `${formatOsName(v.os)} · ${v.ipAddress || "No IP"} · ${v.status}`,
          href: `/vms/${v.id}`,
          badge: v.type.toUpperCase(),
        });
      }
    });

    // Search Templates
    templates.forEach((t) => {
      if (t.name.toLowerCase().includes(q) || (t.os && t.os.toLowerCase().includes(q))) {
        searchResults.push({
          id: `tpl-${t.id}`,
          type: "template",
          title: t.name,
          subtitle: `Template · ${t.arch}`,
          href: `/templates/${t.id}`,
          badge: "STORE",
        });
      }
    });

    // Quick Admin Actions
    const ACTIONS: SearchItem[] = [
      { id: "act-vms", type: "action", title: "Virtual Machines", subtitle: "Manage all guests", href: "/vms" },
      { id: "act-monitor", type: "action", title: "Cluster Monitor", subtitle: "Realtime metrics", href: "/admin/monitor" },
      { id: "act-balancer", type: "action", title: "Cluster Balancer", subtitle: "DRS memory balance", href: "/admin/balancer" },
      { id: "act-settings", type: "action", title: "System Settings", subtitle: "Proxmox & config", href: "/admin/settings" },
    ];
    ACTIONS.forEach((a) => {
      if (a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)) {
        searchResults.push(a);
      }
    });
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md mx-auto hidden sm:block">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search VMs, LXCs, templates, IPs..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="h-9 w-full pl-9 pr-8 text-xs bg-muted/40 border-muted focus:bg-background transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && q.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1.5 shadow-lg z-50 animate-in fade-in-50 slide-in-from-top-1">
          {searchResults.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No matching resources found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {searchResults.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.type === "vm" && <MonitorPlay className="size-4 text-primary shrink-0" />}
                    {item.type === "template" && <Package className="size-4 text-amber-500 shrink-0" />}
                    {item.type === "action" && <Sparkles className="size-4 text-indigo-500 shrink-0" />}
                    <div className="truncate">
                      <div className="font-medium text-foreground truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  function logout() {
    api.post("/auth/logout").catch(() => {});
    clear();
    router.replace("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-2">
        <MobileSidebar />
      </div>

      <GlobalSearchBox />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-9 gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user ? initials(user.displayName) : "?"}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{user?.displayName}</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{user?.displayName}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
                {user?.role === "admin" && (
                  <Badge variant="secondary" className="mt-1 w-fit">
                    Administrator
                  </Badge>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/security")}>
              <ShieldCheck />
              Security
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
