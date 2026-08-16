"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, MonitorPlay, Play, Square, RotateCw, Trash2, Loader2, Box, Cpu, Users, Search, Check } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { VirtualMachine, UserGroup } from "@/lib/types";
import { formatRam, formatDate, formatOsName } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { OwnerGroupHeader } from "@/components/dashboard/owner-group-header";
import { VmStatusBadge } from "@/components/vm/vm-status-badge";
import { TemplateIcon } from "@/components/template-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function parseTags(csv: string | null): string[] {
  return (csv ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

function BulkDeleteDialog({ count, busy, onConfirm }: { count: number; busy: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ready = text.trim() === String(count);
  return (
    <AlertDialog open={open} onOpenChange={(o: boolean) => { setOpen(o); if (!o) setText(""); }}>
      <AlertDialogTrigger
        render={
          <Button size="sm" variant="destructive" disabled={busy}>
            <Trash2 /> Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} virtual machines?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently destroys all selected VMs, their disks, and their snapshots on Proxmox.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <label htmlFor="bulk-delete-confirm-input" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Type <span className="font-mono text-foreground font-semibold">{count}</span> to confirm:
          </label>
          <Input
            id="bulk-delete-confirm-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={String(count)}
            className="font-mono text-sm"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || !ready}
            onClick={() => { onConfirm(); setOpen(false); }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete {count}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TagChips({ tags, onClick }: { tags: string[]; onClick?: (t: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          onClick={onClick ? () => onClick(t) : undefined}
          className={
            "rounded-full border px-2 py-0.5 text-xs text-muted-foreground " +
            (onClick ? "hover:bg-muted" : "cursor-default")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}

interface Selection {
  selected: Set<string>;
  toggle: (id: string) => void;
}

/** Searchable User Dropdown Component for Admins */
function UserSelectDropdown({
  groups,
  selectedUserId,
  onSelectUser,
}: {
  groups: UserGroup[];
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selectedUser = groups.find((g) => g.id === selectedUserId);
  const filteredGroups = groups.filter(
    (g) =>
      g.displayName.toLowerCase().includes(search.toLowerCase()) ||
      g.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            <Users className="size-3.5 text-primary" />
            <span className="font-medium">
              {selectedUserId === null ? "All Users & Owners" : selectedUser?.displayName || "Selected User"}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64 p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search tenant user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          <DropdownMenuItem
            onClick={() => {
              onSelectUser(null);
              setOpen(false);
            }}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <span>All Users ({groups.reduce((n, g) => n + g.vms.length, 0)} VMs)</span>
            {selectedUserId === null && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          {filteredGroups.map((g) => (
            <DropdownMenuItem
              key={g.id}
              onClick={() => {
                onSelectUser(g.id);
                setOpen(false);
              }}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <div className="truncate">
                <div className="font-medium text-foreground truncate">{g.displayName}</div>
                <div className="text-[10px] text-muted-foreground truncate">{g.email}</div>
              </div>
              {selectedUserId === g.id && <Check className="size-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The VM table with STICKY STATIC HEADER and scrollable body rows. */
function VmTable({
  vms,
  selection,
  onTagClick,
}: {
  vms: VirtualMachine[];
  selection?: Selection;
  onTagClick?: (t: string) => void;
}) {
  return (
    <div className="max-h-[calc(100vh-320px)] overflow-y-auto border rounded-md">
      <Table className="min-w-[56rem] table-fixed relative">
        <TableHeader className="sticky top-0 bg-background z-20 border-b border-border shadow-xs">
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {selection && <TableHead className="w-8" />}
            <TableHead className="w-[24%]">Name</TableHead>
            <TableHead className="w-[12%]">Status</TableHead>
            <TableHead className="w-[22%]">Specs</TableHead>
            <TableHead className="w-[18%]">OS</TableHead>
            <TableHead className="w-[14%]">IP Address</TableHead>
            <TableHead className="w-[10%]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vms.map((vm) => (
            <TableRow key={vm.id}>
              {selection && (
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${vm.name}`}
                    checked={selection.selected.has(vm.id)}
                    onChange={() => selection.toggle(vm.id)}
                    className="size-4 align-middle accent-primary"
                  />
                </TableCell>
              )}
              <TableCell className="overflow-hidden">
                <Link
                  href={`/vms/${vm.id}`}
                  className="font-medium hover:underline align-middle inline-block max-w-full truncate text-foreground"
                  title={vm.name}
                >
                  {vm.name}
                </Link>
                {vm.type === "lxc" && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Box className="size-2.5" /> LXC
                  </span>
                )}
                {vm.hasPassthrough && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                    <Cpu className="size-2.5" /> GPU/PCI
                  </span>
                )}
                {vm.access && vm.access !== "owner" && vm.access !== "admin" && (
                  <span className="ml-2 align-middle rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Shared · {vm.access}
                  </span>
                )}
                <TagChips tags={parseTags(vm.tags)} onClick={onTagClick} />
              </TableCell>
              <TableCell>
                <VmStatusBadge status={vm.status} />
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {vm.cpu} vCPU · {formatRam(vm.ram)} · {vm.storage} GB
              </TableCell>
              <TableCell className="overflow-hidden text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <TemplateIcon os={vm.os} name={vm.os} className="size-4 shrink-0" />
                  <span className="truncate font-medium text-foreground/90" title={formatOsName(vm.os)}>
                    {formatOsName(vm.os)}
                  </span>
                </span>
              </TableCell>
              <TableCell className="truncate font-mono text-xs text-foreground/90">{vm.ipAddress ?? "—"}</TableCell>
              <TableCell className="truncate text-muted-foreground">{formatDate(vm.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OwnVmList({ vms, reload }: { vms: VirtualMachine[]; reload: () => Promise<void> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    vms.forEach((v) => parseTags(v.tags).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [vms]);

  const shown = activeTag ? vms.filter((v) => parseTags(v.tags).includes(activeTag)) : vms;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function runBulk(action: "start" | "stop" | "restart" | "delete") {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post<{ results: { id: string; ok: boolean; error?: string }[] }>("/vms/bulk", { action, ids });
      const ok = res.data.results.filter((r) => r.ok).length;
      const failed = res.data.results.length - ok;
      toast.success(`${action}: ${ok} ok${failed ? `, ${failed} failed` : ""}.`);
      setSelected(new Set());
      await reload();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Filter:</span>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
              className={
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors " +
                (activeTag === t
                  ? "border-primary bg-primary text-primary-foreground font-medium"
                  : "bg-background text-muted-foreground hover:bg-muted")
              }
            >
              {t}
            </button>
          ))}
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-xs">
          <span className="font-semibold text-foreground px-1">{selected.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("start")}>
            <Play /> Start
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("restart")}>
            <RotateCw /> Restart
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("stop")}>
            <Square /> Stop
          </Button>
          <BulkDeleteDialog count={selected.size} busy={busy} onConfirm={() => runBulk("delete")} />
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <VmTable vms={shown} selection={{ selected, toggle }} onTagClick={(t) => setActiveTag(t)} />
    </div>
  );
}

export default function VmsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const [vms, setVms] = useState<VirtualMachine[] | null>(null);
  const [groups, setGroups] = useState<UserGroup[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncingInfra, setSyncingInfra] = useState(false);

  const reloadOwn = useCallback(async () => {
    const res = await api.get<VirtualMachine[]>("/vms");
    setVms(res.data);
  }, []);

  const handleSyncInfra = async () => {
    setSyncingInfra(true);
    try {
      const res = await api.post<{ ok: boolean; imported: number; totalDiscovered: number }>("/admin/infra/sync");
      toast.success(`Infrastructure Sync: Imported ${res.data.imported} new guest(s) from Proxmox (${res.data.totalDiscovered} total found).`);
      if (isAdmin) {
        const gRes = await api.get<UserGroup[]>("/admin/all-vms");
        setGroups(gRes.data);
      }
      await reloadOwn();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSyncingInfra(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      api
        .get<UserGroup[]>("/admin/all-vms")
        .then((res) => setGroups(res.data))
        .catch((err) => setError(apiError(err)));
    } else {
      reloadOwn().catch((err) => setError(apiError(err)));
    }
  }, [isAdmin, reloadOwn]);

  const ownerGroups = useMemo(() => {
    if (!groups) return [];
    const list = groups.filter((g) => g.vms.length > 0);
    if (selectedUserId) {
      return list.filter((g) => g.id === selectedUserId);
    }
    return list;
  }, [groups, selectedUserId]);

  const totalVms = groups?.reduce((n, g) => n + g.vms.length, 0) ?? 0;

  const allVmsList: VirtualMachine[] = useMemo(() => {
    if (isAdmin) {
      return groups?.flatMap((g) => g.vms) ?? [];
    }
    return vms ?? [];
  }, [isAdmin, groups, vms]);

  const runningCount = allVmsList.filter((v) => v.status === "running").length;
  const stoppedCount = allVmsList.filter((v) => v.status === "stopped").length;
  const pausedCount = allVmsList.filter((v) => (v.status as string) === "paused" || (v.status as string) === "suspended").length;

  const loading = isAdmin ? groups === null : vms === null;
  const empty = isAdmin ? totalVms === 0 : vms?.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Virtual Machines"
        description={isAdmin ? "Every VM on the cluster, separated by owner." : "Your virtual machines."}
      >
        {isAdmin && groups && groups.length > 1 && (
          <UserSelectDropdown
            groups={groups}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
          />
        )}
        {isAdmin && (
          <Button variant="outline" onClick={handleSyncInfra} disabled={syncingInfra}>
            {syncingInfra ? <Loader2 className="animate-spin" /> : <RotateCw />}
            Sync Proxmox Infra
          </Button>
        )}
        <Button render={<Link href="/vms/new" />}>
          <Plus />
          New VM
        </Button>
      </PageHeader>

      {/* Realtime Power Status Counter Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 shadow-xs border-border">
          <div className="text-xs font-medium text-muted-foreground">Total Guests</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{allVmsList.length}</div>
        </Card>
        <Card className="p-4 shadow-xs border-emerald-500/30 bg-emerald-500/5">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Running (Powered On)</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{runningCount}</div>
        </Card>
        <Card className="p-4 shadow-xs border-slate-500/30 bg-slate-500/5">
          <div className="text-xs font-medium text-muted-foreground">Stopped (Powered Off)</div>
          <div className="mt-1 text-2xl font-bold text-muted-foreground">{stoppedCount}</div>
        </Card>
        <Card className="p-4 shadow-xs border-amber-500/30 bg-amber-500/5">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Paused / Suspended</div>
          <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{pausedCount}</div>
        </Card>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <Card>
          <CardContent className="grid gap-2 py-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </CardContent>
        </Card>
      ) : empty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MonitorPlay className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No virtual machines yet.</p>
            <Button render={<Link href="/vms/new" />} variant="outline">
              <Plus />
              Create your first VM
            </Button>
          </CardContent>
        </Card>
      ) : isAdmin ? (
        <div className="grid gap-6">
          {ownerGroups.map((g) => (
            <Card key={g.id} className="p-4 shadow-xs">
              <OwnerGroupHeader group={g} />
              <div className="mt-3">
                <VmTable vms={g.vms} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <OwnVmList vms={vms!} reload={reloadOwn} />
      )}
    </div>
  );
}
