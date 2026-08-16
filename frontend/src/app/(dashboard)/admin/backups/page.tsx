"use client";

import { useCallback, useEffect, useState } from "react";
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
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Pencil,
  Info,
  Sliders,
  CheckSquare,
  Square,
  ShieldCheck,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<MateStateBackup[] | null>(null);
  const [policies, setPolicies] = useState<VmPolicy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState(false);

  // Proxmox Datacenter Backup Job Management Modal State
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobDetailModal, setJobDetailModal] = useState<VmPolicy | null>(null);
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [vmSearchFilter, setVmSearchFilter] = useState<string>("");
  const [schedulePreset, setSchedulePreset] = useState<string>("weekly");
  const [cronInput, setCronInput] = useState<string>("0 3 * * 0");
  const [keepInput, setKeepInput] = useState<number>(3);
  const [storageInput, setStorageInput] = useState<string>("local");
  const [savingJob, setSavingJob] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      api.get<MateStateBackup[]>("/admin/backups/all"),
      api.get<VmPolicy[]>("/admin/backups/policies"),
    ])
      .then(([bRes, pRes]) => {
        setBackups(bRes.data);
        setPolicies(pRes.data);
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

  const handleToggleSelectVm = (id: string) => {
    setSelectedVmIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllVms = () => {
    if (!policies) return;
    if (selectedVmIds.length === policies.length) {
      setSelectedVmIds([]);
    } else {
      setSelectedVmIds(policies.map((p) => p.id));
    }
  };

  const handlePresetChange = (preset: string) => {
    setSchedulePreset(preset);
    if (preset === "daily") setCronInput("0 3 * * *");
    else if (preset === "weekly") setCronInput("0 3 * * 0");
    else if (preset === "twice_daily") setCronInput("0 */12 * * *");
  };

  const handleSaveJobPolicy = async () => {
    if (selectedVmIds.length === 0) {
      toast.error("Please select at least one target Virtual Machine.");
      return;
    }
    setSavingJob(true);
    try {
      await Promise.all(
        selectedVmIds.map((id) =>
          api.patch(`/vms/${id}`, {
            backupCron: cronInput,
            backupKeep: keepInput,
          })
        )
      );
      toast.success(`Datacenter backup policy saved for ${selectedVmIds.length} guest(s).`);
      setShowJobModal(false);
      loadData();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSavingJob(false);
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

  const filteredVmList = (policies || []).filter((p) => {
    const q = vmSearchFilter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      String(p.proxmoxVmId).includes(q) ||
      p.user.displayName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Datacenter Backup & Restore"
        description="Manage cluster-wide VM & LXC backups, automated schedules, retention policies, and 1-click in-place restores."
      >
        <Button variant="outline" onClick={() => setShowJobModal(true)}>
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
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Datacenter Backup Jobs & Schedules</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Proxmox VE style Datacenter backup job configurations, cron schedule rules, and retention policies.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowJobModal(true)}>
                <Plus className="size-3.5" /> Create Backup Job
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
                            Keep {p.backupKeep || 2}
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

      {/* Enhanced Multi-VM Proxmox Backup Job Modal */}
      <AlertDialog open={showJobModal} onOpenChange={setShowJobModal}>
        <AlertDialogContent className="max-w-xl p-6">
          <AlertDialogHeader className="border-b pb-4">
            <AlertDialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <DatabaseBackup className="size-5" />
              </div>
              <div>
                <div>Add Proxmox Datacenter Backup Job</div>
                <div className="text-xs font-normal text-muted-foreground mt-0.5">
                  Configure multi-VM backup schedule, storage target, and retention keep count.
                </div>
              </div>
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="grid gap-5 py-4 text-xs">
            {/* Step 1: Multi-VM Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  Select Target Virtual Machines ({selectedVmIds.length} selected)
                </label>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={handleSelectAllVms}>
                  {selectedVmIds.length === (policies?.length ?? 0) ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter VMs by name or ID..."
                  value={vmSearchFilter}
                  onChange={(e) => setVmSearchFilter(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="max-h-36 overflow-y-auto border rounded-md p-1.5 space-y-1 bg-muted/20">
                {filteredVmList.map((p) => {
                  const isChecked = selectedVmIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleToggleSelectVm(p.id)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        isChecked ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isChecked ? (
                          <CheckSquare className="size-4 text-primary shrink-0" />
                        ) : (
                          <Square className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-foreground">{p.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">({p.proxmoxVmId})</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {p.type}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Schedule & Cron Presets */}
            <div>
              <label className="block font-semibold text-foreground mb-1.5">Schedule Preset</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Button
                  type="button"
                  variant={schedulePreset === "weekly" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange("weekly")}
                  className="h-8 text-xs"
                >
                  Weekly (Sun 03:00)
                </Button>
                <Button
                  type="button"
                  variant={schedulePreset === "daily" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange("daily")}
                  className="h-8 text-xs"
                >
                  Daily (03:00)
                </Button>
                <Button
                  type="button"
                  variant={schedulePreset === "twice_daily" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange("twice_daily")}
                  className="h-8 text-xs"
                >
                  Every 12 Hours
                </Button>
              </div>
              <Input
                value={cronInput}
                onChange={(e) => setCronInput(e.target.value)}
                placeholder="0 3 * * 0"
                className="font-mono h-9"
              />
            </div>

            {/* Step 3: Retention & Target Storage Pool */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-foreground mb-1">Retention Keep Count</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={keepInput}
                  onChange={(e) => setKeepInput(Number(e.target.value))}
                  className="font-mono h-9"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">Rolls N newest backups</span>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Storage Target Pool</label>
                <Select value={storageInput} onValueChange={(v: any) => setStorageInput(String(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">local (Proxmox Default)</SelectItem>
                    <SelectItem value="PROD-Storage">PROD-Storage</SelectItem>
                    <SelectItem value="vzdump">vzdump</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="border-t pt-4">
            <AlertDialogCancel onClick={() => setShowJobModal(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveJobPolicy} disabled={savingJob}>
              {savingJob ? <Loader2 className="size-4 animate-spin" /> : null}
              Save Datacenter Job ({selectedVmIds.length} VMs)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <span className="font-semibold text-foreground">Keep {jobDetailModal.backupKeep || 2} backups</span>
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
