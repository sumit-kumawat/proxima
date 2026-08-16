"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  DatabaseBackup,
  Loader2,
  Clock,
  Search,
  ShieldCheck,
  CheckSquare,
  Square,
  HardDrive,
  Container,
  MessageSquare,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function NewBackupJobPage() {
  const router = useRouter();

  const [policies, setPolicies] = useState<VmPolicy[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Default empty VM selection - user decides which guests to select
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [vmSearchFilter, setVmSearchFilter] = useState<string>("");
  const [schedulePreset, setSchedulePreset] = useState<string>("weekly");
  const [cronInput, setCronInput] = useState<string>("0 3 * * 0");
  const [keepInput, setKeepInput] = useState<number>(3);
  const [storageInput, setStorageInput] = useState<string>("local");
  const [jobComment, setJobComment] = useState<string>("");
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    api
      .get<VmPolicy[]>("/admin/backups/policies")
      .then((res) => {
        setPolicies(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(apiError(err));
        setLoading(false);
      });
  }, []);

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
      toast.error("Please select at least one target Virtual Machine to create the backup job.");
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
      toast.success(`Backup job saved for ${selectedVmIds.length} guest(s).`);
      router.push("/admin/backups");
    } catch (err) {
      toast.error(apiError(err));
      setSavingJob(false);
    }
  };

  const filteredVmList = (policies || []).filter((p) => {
    const q = vmSearchFilter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      String(p.proxmoxVmId).includes(q) ||
      p.user.displayName.toLowerCase().includes(q) ||
      p.proxmoxNode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Add Backup Job"
        description="Configure multi-VM backup schedules, storage target pool, and retention rules across cluster nodes."
      >
        <Button variant="ghost" render={<Link href="/admin/backups" />}>
          <ArrowLeft className="size-4" /> Back to Backups
        </Button>
      </PageHeader>

      <Card className="shadow-xs">
        {loading ? (
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading virtual machines…
          </CardContent>
        ) : loadError ? (
          <CardContent className="py-8 text-center text-sm text-destructive">{loadError}</CardContent>
        ) : (
          <CardContent className="p-6 space-y-6">
            {/* Section 1: Target Virtual Machines Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" /> Target Virtual Machines ({selectedVmIds.length} selected)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select the guest virtual machines and containers included in this backup policy. None selected by default.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handleSelectAllVms} className="h-8 text-xs">
                  {selectedVmIds.length === (policies?.length ?? 0) ? "Deselect All" : "Select All Guests"}
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter guests by VMID, name, node, or owner..."
                  value={vmSearchFilter}
                  onChange={(e) => setVmSearchFilter(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg p-2.5 space-y-2 bg-muted/20">
                {filteredVmList.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No matching virtual machines found.
                  </div>
                ) : (
                  filteredVmList.map((p) => {
                    const isChecked = selectedVmIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleSelectVm(p.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-primary/10 border-primary/40 shadow-xs font-semibold"
                            : "hover:bg-muted/60 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isChecked ? (
                            <CheckSquare className="size-4 text-primary shrink-0" />
                          ) : (
                            <Square className="size-4 text-muted-foreground shrink-0" />
                          )}
                          <div>
                            <div className="font-medium text-foreground text-xs flex items-center gap-2">
                              {p.type === "lxc" ? <Container className="size-4 text-primary" /> : <HardDrive className="size-4 text-primary" />}
                              {p.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              VMID: {p.proxmoxVmId} · Node: {p.proxmoxNode} · Owner: {p.user.displayName}
                            </div>
                          </div>
                        </div>
                        <Badge variant={isChecked ? "default" : "outline"} className="text-[10px] font-mono uppercase">
                          {p.type}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section 2: Job Comment & Description */}
            <div className="space-y-3 border-t pt-5">
              <FormField label="Job Comment / Description" hint="Optional note or comment describing the purpose of this backup job.">
                <Input
                  value={jobComment}
                  onChange={(e) => setJobComment(e.target.value)}
                  placeholder="e.g. Weekly production database & application snapshot policy"
                  className="h-9 text-xs"
                />
              </FormField>
            </div>

            {/* Section 3: Schedule & Timing */}
            <div className="space-y-3 border-t pt-5">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Clock className="size-5 text-primary" /> Backup Schedule & Timing
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a schedule preset or enter a custom 5-field cron expression.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  type="button"
                  variant={schedulePreset === "weekly" ? "default" : "outline"}
                  onClick={() => handlePresetChange("weekly")}
                  className="h-10 text-xs gap-2 font-medium"
                >
                  <Clock className="size-4 shrink-0" /> Weekly (Sun 03:00)
                </Button>
                <Button
                  type="button"
                  variant={schedulePreset === "daily" ? "default" : "outline"}
                  onClick={() => handlePresetChange("daily")}
                  className="h-10 text-xs gap-2 font-medium"
                >
                  <Clock className="size-4 shrink-0" /> Daily (03:00)
                </Button>
                <Button
                  type="button"
                  variant={schedulePreset === "twice_daily" ? "default" : "outline"}
                  onClick={() => handlePresetChange("twice_daily")}
                  className="h-10 text-xs gap-2 font-medium"
                >
                  <Clock className="size-4 shrink-0" /> Every 12 Hours
                </Button>
              </div>

              <FormField label="Standard 5-Field Cron Expression" hint="e.g. 0 3 * * 0 = Every Sunday at 03:00 AM">
                <Input
                  value={cronInput}
                  onChange={(e) => setCronInput(e.target.value)}
                  placeholder="0 3 * * 0"
                  className="font-mono h-9 text-xs"
                />
              </FormField>
            </div>

            {/* Section 4: Retention & Target Storage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t pt-5">
              <FormField label="Retention Keep Count" hint="Keeps N newest backups before auto-pruning old snapshots.">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={keepInput}
                  onChange={(e) => setKeepInput(Number(e.target.value))}
                  className="font-mono h-9 text-xs"
                />
              </FormField>

              <FormField label="Target Proxmox Storage Pool" hint="Proxmox storage pool where backup volumes are saved.">
                <Select value={storageInput} onValueChange={(v: any) => setStorageInput(String(v))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">local (Proxmox Default Directory)</SelectItem>
                    <SelectItem value="PROD-Storage">PROD-Storage (NFS/Ceph Shared)</SelectItem>
                    <SelectItem value="vzdump">vzdump (Proxmox Backup Target)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Page Footer Navigation Action Buttons */}
            <div className="flex items-center justify-between border-t pt-5">
              <Button type="button" variant="outline" render={<Link href="/admin/backups" />}>
                <ArrowLeft className="size-4" /> Cancel
              </Button>

              <Button
                type="button"
                variant="default"
                onClick={handleSaveJobPolicy}
                disabled={savingJob || selectedVmIds.length === 0}
              >
                {savingJob ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
                Save Backup Job ({selectedVmIds.length} Guests)
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
