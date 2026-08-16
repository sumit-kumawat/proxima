"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DatabaseBackup,
  RotateCcw,
  Trash2,
  Play,
  Loader2,
  HardDrive,
  Download,
  Calendar,
  Search,
  Clock,
  Plus,
  Info,
  Sliders,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface MateStateBackup {
  id: string;
  vmId: string;
  proxmoxVmId: number;
  proxmoxNode: string;
  storage: string;
  volid: string;
  size: number;
  status: "creating" | "ready" | "restoring" | "error";
  kind: "scheduled" | "manual";
  notes: string | null;
  createdAt: string;
  vm?: {
    id: string;
    name: string;
    type: string;
    proxmoxVmId: number;
    user: { id: string; email: string; displayName: string };
  };
}

interface VmPolicy {
  id: string;
  name: string;
  proxmoxVmId: number;
  proxmoxNode: string;
  type: string;
  backupCron: string | null;
  backupKeep: number | null;
  user: { email: string; displayName: string };
}

interface ProxmoxClusterJob {
  id?: string;
  vmid?: string;
  schedule?: string;
  storage?: string;
  comment?: string;
  enabled?: number | boolean;
  starttime?: string;
  dow?: string;
}

interface PoliciesResponse {
  jobs?: ProxmoxClusterJob[];
  vms?: VmPolicy[];
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<MateStateBackup[] | null>(null);
  const [policies, setPolicies] = useState<VmPolicy[] | null>(null);
  const [clusterJobs, setClusterJobs] = useState<ProxmoxClusterJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState(false);
  const [jobDetailModal, setJobDetailModal] = useState<VmPolicy | null>(null);

  const loadData = useCallback(() => {
    Promise.all([
      api.get<MateStateBackup[]>("/admin/backups/all"),
      api.get<PoliciesResponse | VmPolicy[]>("/admin/backups/policies"),
    ])
      .then(([bRes, pRes]) => {
        setBackups(bRes.data);
        if (Array.isArray(pRes.data)) {
          setPolicies(pRes.data);
          setClusterJobs([]);
        } else {
          setPolicies(pRes.data.vms || []);
          setClusterJobs(pRes.data.jobs || []);
        }
        setError(null);
      })
      .catch((err) => setError(apiError(err)));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunNow = async (vmId?: string) => {
    setRunningJob(true);
    try {
      const res = await api.post<{ ok: boolean; message?: string }>("/admin/backups/run-now", { vmId });
      toast.success(res.data.message || "Backup triggered successfully.");
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setRunningJob(false);
    }
  };

  const handleRestore = async (backup: MateStateBackup) => {
    setBusyId(backup.id);
    try {
      const res = await api.post<{ ok: boolean; message: string }>(`/admin/backups/${backup.id}/restore`);
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    setBusyId(backupId);
    try {
      await api.delete(`/admin/backups/${backupId}`);
      toast.success("Backup volume deleted successfully.");
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadToken = async (backupId: string) => {
    try {
      const res = await api.post<{ url: string }>(`/vms/matestates/${backupId}/download-token`);
      window.open(res.data.url, "_blank");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const filteredBackups = (backups || []).filter((b) => {
    const q = search.toLowerCase();
    return (
      b.volid.toLowerCase().includes(q) ||
      b.storage.toLowerCase().includes(q) ||
      (b.vm?.name && b.vm.name.toLowerCase().includes(q)) ||
      (b.vm?.user?.email && b.vm.user.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Datacenter Backup & Restore"
        description="Manage cluster-wide VM & LXC backups, automated schedules, retention policies, and 1-click in-place restores."
      >
        <Button variant="outline" render={<Link href="/admin/backups/new" />}>
          <Plus className="size-4" /> Add Backup Job
        </Button>
        <Button variant="default" onClick={() => handleRunNow()} disabled={runningJob}>
          {runningJob ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run Cluster Backup Job
        </Button>
      </PageHeader>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="backups" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="backups" className="gap-2">
            <DatabaseBackup className="size-4" />
            Cluster Backups ({backups?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-2">
            <Calendar className="size-4" />
            Backup Jobs & Policies ({policies?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: All Cluster Backups */}
        <TabsContent value="backups" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search backup volume, VM, storage, owner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              Refresh Backups
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {backups === null ? (
                <div className="grid gap-2 p-6">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : filteredBackups.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No backup volumes found on the cluster.
                </div>
              ) : (
                <div className="max-h-[calc(100vh-320px)] overflow-y-auto border rounded-md">
                  <Table className="min-w-[56rem] table-fixed relative">
                    <TableHeader className="sticky top-0 bg-background z-20 border-b border-border shadow-xs">
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[22%]">VM / Guest</TableHead>
                        <TableHead className="w-[18%]">Owner</TableHead>
                        <TableHead className="w-[20%]">Volume / Storage</TableHead>
                        <TableHead className="w-[12%]">Size</TableHead>
                        <TableHead className="w-[12%]">Created</TableHead>
                        <TableHead className="w-[16%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBackups.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <HardDrive className="size-4 text-primary shrink-0" />
                              <div className="truncate">
                                <div className="font-semibold text-foreground truncate">
                                  {b.vm?.name || `VM ${b.proxmoxVmId}`}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  ID: {b.proxmoxVmId} · {b.proxmoxNode}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="truncate text-xs text-muted-foreground">
                            {b.vm?.user?.displayName || b.vm?.user?.email || "Admin"}
                          </TableCell>
                          <TableCell className="truncate">
                            <div className="text-xs font-mono text-foreground truncate" title={b.volid}>
                              {b.volid}
                            </div>
                            <Badge variant="outline" className="mt-0.5 text-[10px] uppercase">
                              {b.storage}
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate font-mono text-xs text-foreground">
                            {formatBytes(b.size)}
                          </TableCell>
                          <TableCell className="truncate text-xs text-muted-foreground">
                            {formatDate(b.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click In-Place Restore */}
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busyId === b.id || b.status !== "ready"}
                                      title="Restore VM in-place from this backup"
                                      className="h-8 gap-1 text-xs"
                                    >
                                      {busyId === b.id ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <RotateCcw className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                      )}
                                      Restore
                                    </Button>
                                  }
                                />
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restore {b.vm?.name || `VM ${b.proxmoxVmId}`}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will stop the guest and restore its disks in-place to the state captured on{" "}
                                      {formatDate(b.createdAt)}. Existing unbacked data will be overwritten.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRestore(b)}>
                                      Confirm Restore
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              {/* Download Backup */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadToken(b.id)}
                                title="Download backup volume"
                                className="h-8 w-8 p-0"
                              >
                                <Download className="size-3.5" />
                              </Button>

                              {/* Delete Backup */}
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={busyId === b.id}
                                      title="Delete backup volume"
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  }
                                />
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Backup Volume?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete volume {b.volid} from Proxmox storage.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => handleDelete(b.id)}>
                                      Delete Volume
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Backup Policies & Schedules */}
        <TabsContent value="policies" className="space-y-6">
          {clusterJobs.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <DatabaseBackup className="size-4 text-primary" /> Registered Proxmox Cluster Backup Jobs ({clusterJobs.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Active cluster-level VZDump backup schedules registered on Proxmox VE.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="border rounded-md bg-background overflow-hidden">
                  <Table className="min-w-[40rem] text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[30%]">Job ID / Target VMs</TableHead>
                        <TableHead className="w-[25%]">Cron / Schedule</TableHead>
                        <TableHead className="w-[20%]">Storage Pool</TableHead>
                        <TableHead className="w-[15%]">Status</TableHead>
                        <TableHead className="w-[10%] text-right">Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clusterJobs.map((j, idx) => (
                        <TableRow key={j.id || idx}>
                          <TableCell className="font-mono font-medium">
                            <div>{j.id || `backup-job-${idx + 1}`}</div>
                            <div className="text-[11px] text-muted-foreground">VMs: {j.vmid || "All Cluster VMs"}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[11px] gap-1">
                              <Clock className="size-3 text-primary" /> {j.schedule || j.starttime || "Default"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{j.storage || "local"}</TableCell>
                          <TableCell>
                            <Badge variant={j.enabled !== 0 ? "default" : "secondary"} className="text-[10px]">
                              {j.enabled !== 0 ? "Active / Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground truncate max-w-[120px]">
                            {j.comment || "Proxima Backup Job"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Datacenter Guest Schedules & Policies</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Individual virtual machine & container backup schedules and retention rules.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" render={<Link href="/admin/backups/new" />}>
                <Plus className="size-3.5" /> Add Backup Job
              </Button>
            </CardHeader>
            <CardContent>
              {policies === null ? (
                <div className="grid gap-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <div className="max-h-[calc(100vh-320px)] overflow-y-auto border rounded-md">
                  <Table className="min-w-[48rem] table-fixed relative">
                    <TableHeader className="sticky top-0 bg-background z-20 border-b border-border shadow-xs">
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[28%]">Guest VM / LXC</TableHead>
                        <TableHead className="w-[22%]">Owner</TableHead>
                        <TableHead className="w-[25%]">Schedule Cron</TableHead>
                        <TableHead className="w-[15%]">Retention</TableHead>
                        <TableHead className="w-[10%] text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="font-semibold text-foreground">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              ID: {p.proxmoxVmId} · {p.proxmoxNode} ({p.type.toUpperCase()})
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.user.displayName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs gap-1">
                              <Clock className="size-3 text-primary" />
                              {p.backupCron || "0 3 * * 0 (Sundays @ 03:00)"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground">
                            Keep {p.backupKeep || 3}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setJobDetailModal(p)}
                              title="View Backup Job Details"
                            >
                              <Info className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Backup Job Details View Modal */}
      {jobDetailModal && (
        <AlertDialog open={Boolean(jobDetailModal)} onOpenChange={() => setJobDetailModal(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sliders className="size-5 text-primary" />
                Backup Job Details — {jobDetailModal.name}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3 py-2 text-xs border-y my-2 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guest Name:</span>
                <span className="font-semibold text-foreground">{jobDetailModal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proxmox VMID:</span>
                <span className="font-semibold text-foreground">{jobDetailModal.proxmoxVmId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proxmox Node:</span>
                <span className="font-semibold text-foreground">{jobDetailModal.proxmoxNode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guest Type:</span>
                <span className="font-semibold text-foreground uppercase">{jobDetailModal.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cron Schedule:</span>
                <span className="font-semibold text-foreground">{jobDetailModal.backupCron || "0 3 * * 0"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retention Policy:</span>
                <span className="font-semibold text-foreground">Keep {jobDetailModal.backupKeep || 3} backups</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compression:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">zstd (Proxmox Default)</span>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setJobDetailModal(null)}>Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
