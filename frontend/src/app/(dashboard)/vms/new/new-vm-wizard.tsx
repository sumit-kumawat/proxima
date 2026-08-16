"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Rocket,
  HardDrive,
  KeyRound,
  Server,
  Container,
  ArchiveRestore,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { MeResponse, ProxmoxIso, LxcTemplate, Template, VirtualMachine, SshKey } from "@/lib/types";
import { formatRam } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { TemplateIcon } from "@/components/template-icon";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RAM_OPTIONS = [1, 2, 4, 8, 16, 32];
const CUSTOM = "custom";
const CONTAINER = "container"; // LXC container source
const RESTORE = "restore"; // restore an uploaded MateState backup
const CUSTOM_DISK_DEFAULT = 20;
const CONTAINER_DISK_DEFAULT = 8;

/** A downloaded MateState is a vzdump archive — same shape the backend enforces. */
const VZDUMP_FILE_RE = /^vzdump-(qemu|lxc)-\d+-[\w.-]+\.(vma|tar)(\.(zst|gz|lzo))?$/;

/** One-click "T-shirt" sizes that pre-fill cpu/ram/disk; disk is clamped up to a
 *  template's base. Tweak any field afterwards — these are just sensible starts. */
const SIZE_PRESETS = [
  { key: "s", label: "Small", cpu: 1, ramGb: 2, diskGb: 20 },
  { key: "m", label: "Medium", cpu: 2, ramGb: 4, diskGb: 40 },
  { key: "l", label: "Large", cpu: 4, ramGb: 8, diskGb: 80 },
  { key: "xl", label: "X-Large", cpu: 8, ramGb: 16, diskGb: 160 },
] as const;

/** Snippet filename for a feature combo — must mirror the backend (sorted, hyphen-joined). */
const cloudSnippetFile = (ids: string[]) => `proxima-${[...ids].sort().join("-")}.yaml`;

/** Best-guess default cloud-init login user from a template's OS label. */
function cloudUserForOs(os: string | null): string {
  const s = (os ?? "").toLowerCase();
  if (s.includes("ubuntu")) return "ubuntu";
  if (s.includes("fedora")) return "fedora";
  if (s.includes("alma")) return "almalinux";
  if (s.includes("rocky")) return "rocky";
  if (s.includes("centos") || s.includes("oracle")) return "cloud-user";
  if (s.includes("arch")) return "arch";
  if (s.includes("suse")) return "opensuse";
  return "debian";
}

export default function NewVmWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");

  // 4-Step Wizard Step Control
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userMe, setUserMe] = useState<MeResponse | null>(null);
  const [isos, setIsos] = useState<ProxmoxIso[]>([]);
  const [lxcTemplates, setLxcTemplates] = useState<LxcTemplate[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedKeys, setSavedKeys] = useState<SshKey[]>([]);
  const [availableFeatures, setAvailableFeatures] = useState<{ id: string; label: string; hint: string }[]>([]);
  const [cloudBase, setCloudBase] = useState<{ id: string; label: string }[]>([]);

  const [source, setSource] = useState<string>(CUSTOM);
  const [name, setName] = useState("");
  const [cpu, setCpu] = useState(1);
  const [ramGb, setRamGb] = useState(2);
  const [storageGb, setStorageGb] = useState(CUSTOM_DISK_DEFAULT);
  const [iso, setIso] = useState("");
  const [lxcTemplate, setLxcTemplate] = useState("");
  const [password, setPassword] = useState("");
  const [sshKey, setSshKey] = useState("");
  const [username, setUsername] = useState("debian");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [restoreEnabled, setRestoreEnabled] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const SELF = "self";
  const AUTO_NODE = "auto";
  const [adminUsers, setAdminUsers] = useState<{ id: string; email: string; displayName: string }[]>([]);
  const [adminNodes, setAdminNodes] = useState<string[]>([]);
  const [forUserId, setForUserId] = useState<string>(SELF);
  const [countQuota, setCountQuota] = useState(true);
  const [nodeChoice, setNodeChoice] = useState<string>(AUTO_NODE);

  const meId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<{ id: string; email: string; displayName: string }[]>("/admin/all-vms")
      .then((r) => setAdminUsers(r.data.filter((u) => u.id !== meId)))
      .catch(() => setAdminUsers([]));
    api
      .get<{ nodes: { name: string; online: boolean }[] }>("/admin/nodes")
      .then((r) => setAdminNodes(r.data.nodes.filter((n) => n.online).map((n) => n.name)))
      .catch(() => setAdminNodes([]));
  }, [isAdmin, meId]);

  useEffect(() => {
    Promise.all([
      api.get<MeResponse>("/auth/me"),
      api.get<ProxmoxIso[]>("/proxmox/isos"),
      api.get<Template[]>("/templates"),
      api
        .get<{
          features: { id: string; label: string; hint: string }[];
          nodes: Record<string, string[]>;
          base?: { id: string; label: string }[];
        }>("/templates/cloud-init-extras")
        .then((r) => r.data)
        .catch(() => ({ features: [], nodes: {}, base: [] })),
      api
        .get<LxcTemplate[]>("/proxmox/lxc-templates")
        .then((r) => r.data)
        .catch(() => []),
      api
        .get<SshKey[]>("/security/ssh-keys")
        .then((r) => r.data)
        .catch(() => []),
      api
        .get<{ enabled: boolean }>("/vms/restore-upload/status")
        .then((r) => r.data.enabled)
        .catch(() => false),
    ])
      .then(([meRes, isoRes, tplRes, extrasRes, lxcRes, sshRes, restoreOk]) => {
        setUserMe(meRes.data);
        setIsos(isoRes.data);
        setLxcTemplates(lxcRes);
        const pub = tplRes.data.filter((t) => t.published);
        setTemplates(pub);
        setSavedKeys(sshRes);
        setRestoreEnabled(restoreOk);
        setAvailableFeatures(extrasRes.features ?? []);
        setCloudBase(extrasRes.base ?? []);

        if (sshRes.length > 0 && sshRes[0]?.publicKey) {
          setSshKey(sshRes[0].publicKey);
        }

        if (isoRes.data.length > 0) {
          setIso(isoRes.data[0]!.volid);
        }
        if (lxcRes.length > 0) {
          setLxcTemplate(lxcRes[0]!.volid);
        }

        const pre = searchParams.get("template");
        if (pre && pub.some((t) => t.id === pre)) {
          applySourceSelection(pre, pub, isoRes.data, lxcRes);
        } else if (pub.length > 0) {
          applySourceSelection(pub[0]!.id, pub, isoRes.data, lxcRes);
        } else {
          applySourceSelection(CUSTOM, pub, isoRes.data, lxcRes);
        }

        setLoading(false);
      })
      .catch((err) => {
        setLoadError(apiError(err));
        setLoading(false);
      });
  }, [searchParams]);

  // Reactive auto-initialization for LXC Container templates
  useEffect(() => {
    if (lxcTemplates.length > 0 && (!lxcTemplate || !lxcTemplates.some((t) => t.volid === lxcTemplate))) {
      setLxcTemplate(lxcTemplates[0]!.volid);
    }
  }, [lxcTemplates, source, lxcTemplate]);

  // Reactive auto-initialization for ISO images
  useEffect(() => {
    if (isos.length > 0 && (!iso || !isos.some((i) => i.volid === iso))) {
      setIso(isos[0]!.volid);
    }
  }, [isos, source, iso]);

  function applySourceSelection(
    src: string,
    tplList = templates,
    isoList = isos,
    lxcList = lxcTemplates,
  ) {
    setSource(src);
    setErrors({});
    const tpl = tplList.find((t) => t.id === src);
    if (tpl) {
      const min = tpl.diskGb ?? 10;
      setStorageGb((s) => Math.max(s, min));
      setUsername(cloudUserForOs(tpl.os));
    } else if (src === CONTAINER) {
      setStorageGb(CONTAINER_DISK_DEFAULT);
      if (lxcList.length > 0) {
        setLxcTemplate(lxcList[0]!.volid);
      }
    } else if (src === CUSTOM) {
      setStorageGb(CUSTOM_DISK_DEFAULT);
      if (isoList.length > 0) {
        setIso(isoList[0]!.volid);
      }
    }
  }

  function onSourceChange(src: string) {
    applySourceSelection(src);
  }

  const isCustom = source === CUSTOM;
  const isContainer = source === CONTAINER;
  const isRestore = source === RESTORE;
  const template = templates.find((t) => t.id === source);
  const isCloud = Boolean(template?.cloudInit);

  const minDisk = template ? template.diskGb : isContainer ? CONTAINER_DISK_DEFAULT : 10;
  const maxCpuAllowed = userMe?.user.quota.cpu.max ?? 4;
  const maxRamGbAllowed = Math.floor((userMe?.user.quota.ram.max ?? 8192) / 1024);
  const maxStorageGbAllowed = userMe?.user.quota.storage.max ?? 100;

  const effectiveQuotaUser =
    isAdmin && forUserId !== SELF
      ? adminUsers.find((u) => u.id === forUserId)
      : null;

  const cpuLeft = userMe?.user.quota
    ? userMe.user.quota.cpu.max - userMe.user.quota.cpu.used
    : 999;
  const ramLeftMb = userMe?.user.quota
    ? userMe.user.quota.ram.max - userMe.user.quota.ram.used
    : 999999;
  const storageLeft = userMe?.user.quota
    ? userMe.user.quota.storage.max - userMe.user.quota.storage.used
    : 9999;

  function presetFits(p: (typeof SIZE_PRESETS)[number]) {
    if (isAdmin && (forUserId === SELF || !countQuota)) return true;
    const diskNeeded = Math.max(p.diskGb, minDisk);
    return (
      p.cpu <= cpuLeft &&
      p.cpu <= maxCpuAllowed &&
      p.ramGb * 1024 <= ramLeftMb &&
      p.ramGb <= maxRamGbAllowed &&
      diskNeeded <= storageLeft &&
      diskNeeded <= maxStorageGbAllowed
    );
  }

  function applyPreset(p: (typeof SIZE_PRESETS)[number]) {
    setCpu(p.cpu);
    setRamGb(p.ramGb);
    setStorageGb(Math.max(p.diskGb, minDisk));
  }

  const activePreset = SIZE_PRESETS.find(
    (p) => p.cpu === cpu && p.ramGb === ramGb && Math.max(p.diskGb, minDisk) === storageGb,
  )?.key;

  // Strict Stage Validation Helpers
  const isStep1Valid = Boolean(name.trim());
  const isStep2Valid = isCustom
    ? Boolean(iso)
    : isContainer
    ? Boolean(lxcTemplate || (lxcTemplates.length > 0 && lxcTemplates[0]?.volid))
    : isRestore
    ? Boolean(backupFile)
    : Boolean(template || (source && source !== CUSTOM && source !== CONTAINER));
  const isStep3Valid =
    cpu > 0 &&
    ramGb > 0 &&
    storageGb >= minDisk &&
    (isAdmin || (cpu <= cpuLeft && ramGb * 1024 <= ramLeftMb && storageGb <= storageLeft));
  const isStep4Valid = (isContainer || isCloud)
    ? Boolean(sshKey.trim() || password)
    : true;

  const canProceed =
    step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : step === 3 ? isStep3Valid : isStep4Valid;

  const progressPct = step * 25;

  const nextStep = () => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!name.trim()) {
        errs.name = "Enter a virtual machine name before proceeding";
        setErrors(errs);
        return;
      }
      setErrors({});
      setStep(2);
    } else if (step === 2) {
      if (isCustom && !iso) errs.iso = "Select an ISO image";
      if (isContainer && !lxcTemplate) errs.lxcTemplate = "Select a container template";
      if (isRestore && !backupFile) errs.backupFile = "Select a backup file";
      if (Object.keys(errs).length) {
        setErrors(errs);
        return;
      }
      setErrors({});
      setStep(3);
    } else if (step === 3) {
      if (!isAdmin || (forUserId !== SELF && countQuota)) {
        if (cpu > cpuLeft) errs.cpu = `Exceeds remaining CPU quota (${cpuLeft} vCPU)`;
        if (ramGb * 1024 > ramLeftMb) errs.ram = `Exceeds remaining RAM quota (${formatRam(ramLeftMb)})`;
        if (storageGb > storageLeft) errs.storage = `Exceeds remaining storage quota (${storageLeft} GB)`;
      }
      if (Object.keys(errs).length) {
        setErrors(errs);
        return;
      }
      setErrors({});
      setStep(4);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canProceed) return;
    setSubmitting(true);
    try {
      if (isRestore) {
        if (!backupFile) {
          setErrors({ backupFile: "Select a backup file" });
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.append("backup", backupFile);
        if (name.trim()) formData.append("name", name.trim());
        const targetQuery = isAdmin && forUserId !== SELF ? `?forUserId=${encodeURIComponent(forUserId)}` : "";
        const res = await api.post<{ ok: boolean; vm: VirtualMachine }>(
          `/vms/restore-upload${targetQuery}`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (ev) => {
              if (ev.total) setUploadPct(Math.round((ev.loaded * 100) / ev.total));
            },
          },
        );
        toast.success(`"${res.data.vm.name}" restored successfully.`);
        router.push(`/vms/${res.data.vm.id}`);
      } else if (isCustom) {
        const osBasename = iso.includes('/') ? iso.split('/').pop()! : iso.includes(':') ? iso.split(':').pop()! : iso;
        const payload: Record<string, unknown> = {
          name: name.trim(),
          cpu,
          ram: ramGb * 1024,
          ramMb: ramGb * 1024,
          storage: storageGb,
          storageGb,
          os: osBasename,
          iso,
        };
        if (isAdmin) {
          if (forUserId !== SELF) {
            payload.forUserId = forUserId;
            payload.countQuota = countQuota;
          }
          if (nodeChoice !== AUTO_NODE) payload.node = nodeChoice;
        }
        const res = await api.post<{ vm: VirtualMachine }>("/vms", payload);
        toast.success(`Virtual machine "${res.data.vm.name}" created.`);
        router.push(`/vms/${res.data.vm.id}`);
      } else if (isContainer) {
        const targetLxcTemplate = lxcTemplate || (lxcTemplates.length > 0 ? lxcTemplates[0]!.volid : "");
        const payload: Record<string, unknown> = {
          name: name.trim(),
          cpu,
          ram: ramGb * 1024,
          ramMb: ramGb * 1024,
          storage: storageGb,
          storageGb,
          template: targetLxcTemplate,
          lxcTemplate: targetLxcTemplate,
          sshKey: sshKey.trim() || undefined,
          password: password || undefined,
        };
        if (isAdmin) {
          if (forUserId !== SELF) {
            payload.forUserId = forUserId;
            payload.countQuota = countQuota;
          }
          if (nodeChoice !== AUTO_NODE) payload.node = nodeChoice;
        }
        const res = await api.post<{ vm: VirtualMachine }>("/vms/lxc", payload);
        toast.success(`Container "${res.data.vm.name}" created.`);
        router.push(`/vms/${res.data.vm.id}`);
      } else {
        const payload: Record<string, unknown> = {
          templateId: source,
          name: name.trim(),
          cpu,
          ramMb: ramGb * 1024,
          storageGb,
          sshKey: sshKey.trim() || undefined,
          password: password || undefined,
          username: username.trim() || undefined,
          cloudInitFeatures: selectedFeatures.length ? selectedFeatures : undefined,
        };
        if (isAdmin && forUserId !== SELF) {
          payload.forUserId = forUserId;
          payload.countQuota = countQuota;
        }
        const res = await api.post<{ vm: VirtualMachine }>("/templates/deploy", payload);
        toast.success(`Virtual machine "${res.data.vm.name}" deployed.`);
        router.push(`/vms/${res.data.vm.id}`);
      }
    } catch (err) {
      toast.error(apiError(err));
      setUploadPct(null);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Create a Virtual Machine"
        description="Build from scratch with an ISO, or clone a ready-made template in a 4-step wizard."
      >
        <Button variant="ghost" render={<Link href="/vms" />}>
          <ArrowLeft /> Back to VMs
        </Button>
      </PageHeader>

      <Card className="shadow-xs">
        {loading ? (
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading configuration wizard…
          </CardContent>
        ) : loadError ? (
          <CardContent className="py-8 text-center text-sm text-destructive">{loadError}</CardContent>
        ) : (
          <CardContent className="p-6">
            {/* Visual Progress Bar Tracker */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Stage {step} of 4: {step === 1 ? "General & Mode" : step === 2 ? "OS Image & Target Node" : step === 3 ? "Hardware & Sizing" : "Access & Review"}</span>
                <span>{progressPct}% Completed</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 shadow-xs"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* 4-Step Wizard Header Indicator */}
            <div className="mb-8 border-b pb-6">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium">
                <div
                  onClick={() => setStep(1)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    step === 1 ? "bg-primary/10 border border-primary/30 text-primary font-semibold" : isStep1Valid ? "text-foreground hover:bg-muted" : "text-muted-foreground"
                  }`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isStep1Valid ? "bg-emerald-500 text-white" : step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isStep1Valid && step > 1 ? <Check className="size-3.5" /> : "1"}
                  </span>
                  <span className="truncate">General & Mode</span>
                </div>

                <div
                  onClick={() => isStep1Valid && setStep(2)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    step === 2 ? "bg-primary/10 border border-primary/30 text-primary font-semibold" : isStep2Valid ? "text-foreground hover:bg-muted" : "text-muted-foreground opacity-60"
                  }`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isStep2Valid && step > 2 ? "bg-emerald-500 text-white" : step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isStep2Valid && step > 2 ? <Check className="size-3.5" /> : "2"}
                  </span>
                  <span className="truncate">OS Image & Node</span>
                </div>

                <div
                  onClick={() => isStep1Valid && isStep2Valid && setStep(3)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    step === 3 ? "bg-primary/10 border border-primary/30 text-primary font-semibold" : isStep3Valid ? "text-foreground hover:bg-muted" : "text-muted-foreground opacity-60"
                  }`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isStep3Valid && step > 3 ? "bg-emerald-500 text-white" : step === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isStep3Valid && step > 3 ? <Check className="size-3.5" /> : "3"}
                  </span>
                  <span className="truncate">Hardware & Sizing</span>
                </div>

                <div
                  onClick={() => isStep1Valid && isStep2Valid && isStep3Valid && setStep(4)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    step === 4 ? "bg-primary/10 border border-primary/30 text-primary font-semibold" : "text-muted-foreground opacity-60"
                  }`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step === 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    4
                  </span>
                  <span className="truncate">Access & Review</span>
                </div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              {/* STEP 1: General & Mode */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-base font-semibold text-foreground">Step 1: General & Mode</h3>
                    <p className="text-xs text-muted-foreground">Specify virtual machine identity and creation mode.</p>
                  </div>

                  <FormField label="Virtual Machine Name" htmlFor="name" error={errors.name} hint="Use letters, numbers, and hyphens (e.g. web-server-01). Required to proceed.">
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="web-server-01" autoFocus />
                  </FormField>

                  <FormField label="Guest Creation Mode">
                    <Select value={source} onValueChange={(v: any) => onSourceChange(String(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CUSTOM}>
                          <span className="flex items-center gap-2">
                            <Plus className="size-3.5 text-primary" /> Custom VM (install from ISO)
                          </span>
                        </SelectItem>
                        <SelectItem value={CONTAINER}>
                          <span className="flex items-center gap-2">
                            <Container className="size-3.5 text-primary" /> Container (LXC)
                          </span>
                        </SelectItem>
                        {templates.length > 0 && (
                          <SelectGroup>
                            <SelectSeparator />
                            <SelectLabel>Template Store</SelectLabel>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <span className="flex items-center gap-2">
                                  <TemplateIcon os={t.os} name={t.name} icon={t.icon} className="size-3.5" /> {t.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {restoreEnabled && (
                          <SelectGroup>
                            <SelectSeparator />
                            <SelectItem value={RESTORE}>
                              <span className="flex items-center gap-2">
                                <ArchiveRestore className="size-3.5 text-primary" /> Restore from old build
                              </span>
                            </SelectItem>
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>

                  {isAdmin && (
                    <div className="grid gap-3 rounded-md border bg-muted/40 p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Rocket className="size-3.5 text-primary" /> Admin options
                      </div>
                      <FormField label="Deploy for">
                        <Select value={forUserId} onValueChange={(v: any) => setForUserId(String(v))}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SELF}>Myself (admin)</SelectItem>
                            {adminUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.displayName} ({u.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: OS Image & Node */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-base font-semibold text-foreground">Step 2: OS Image & Target Node</h3>
                    <p className="text-xs text-muted-foreground">Select operating system image and Proxmox node target.</p>
                  </div>

                  {isCustom && (
                    <FormField label="ISO Image" error={errors.iso} hint="Select an ISO image to boot from. Required to proceed.">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        {isos.map((i) => {
                          const isSelected = iso === i.volid;
                          return (
                            <div
                              key={i.volid}
                              onClick={() => setIso(i.volid)}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/50 hover:bg-muted/50"
                              }`}
                            >
                              <HardDrive className={`size-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <div className="truncate text-xs">
                                <div className="font-medium text-foreground truncate">{i.name}</div>
                                <div className="text-[11px] text-muted-foreground font-mono truncate">{i.volid}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Select value={iso} onValueChange={(v: any) => setIso(String(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select ISO..." />
                        </SelectTrigger>
                        <SelectContent>
                          {isos.map((i) => (
                            <SelectItem key={i.volid} value={i.volid}>
                              {i.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}

                  {isContainer && (
                    <FormField label="Container Template" error={errors.lxcTemplate} hint="Select an LXC Linux container template. Required to proceed.">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        {lxcTemplates.map((t) => {
                          const isSelected = lxcTemplate === t.volid;
                          return (
                            <div
                              key={t.volid}
                              onClick={() => setLxcTemplate(t.volid)}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                isSelected ? "border-primary bg-primary/10 font-semibold shadow-xs" : "hover:border-primary/50 hover:bg-muted/50"
                              }`}
                            >
                              <Container className={`size-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <div className="truncate text-xs">
                                <div className="font-medium text-foreground truncate">{t.name}</div>
                                <div className="text-[11px] text-muted-foreground font-mono truncate">{t.volid}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Select value={lxcTemplate} onValueChange={(v: any) => setLxcTemplate(String(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={lxcTemplates.length ? "Select LXC template..." : "No container templates available"} />
                        </SelectTrigger>
                        <SelectContent>
                          {lxcTemplates.map((t) => (
                            <SelectItem key={t.volid} value={t.volid}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}

                  {isRestore && (
                    <FormField label="MateState Backup File" error={errors.backupFile}>
                      <Input
                        type="file"
                        accept=".zst,.gz,.lzo,.vma,.tar"
                        onChange={(e) => {
                          setBackupFile(e.target.files?.[0] ?? null);
                          setErrors({});
                        }}
                        className="cursor-pointer"
                      />
                    </FormField>
                  )}

                  {isAdmin && (
                    <FormField label="Proxmox Node Target" hint="Auto-select places on node with best capacity.">
                      <Select value={nodeChoice} onValueChange={(v: any) => setNodeChoice(String(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={AUTO_NODE}>Auto-select (recommended)</SelectItem>
                          {adminNodes.map((n) => (
                            <SelectItem key={n} value={n}>
                              <span className="flex items-center gap-2">
                                <Server className="size-3.5" /> {n}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                </div>
              )}

              {/* STEP 3: Hardware & Sizing */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-base font-semibold text-foreground">Step 3: Hardware & Sizing</h3>
                    <p className="text-xs text-muted-foreground">Pick a sizing preset or customize CPU, RAM, and Disk storage.</p>
                  </div>

                  <FormField label="Sizing Presets">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SIZE_PRESETS.map((p) => {
                        const fits = presetFits(p);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p)}
                            disabled={!fits}
                            className={`rounded-lg border p-2.5 text-left transition-colors ${
                              !fits
                                ? "cursor-not-allowed opacity-40"
                                : activePreset === p.key
                                  ? "border-primary bg-primary/10 font-semibold"
                                  : "hover:border-primary/50 hover:bg-muted"
                            }`}
                          >
                            <div className="text-sm font-medium">{p.label}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {p.cpu} vCPU · {p.ramGb} GB RAM
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Math.max(p.diskGb, minDisk)} GB Disk
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </FormField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="vCPU Cores" error={errors.cpu}>
                      <Input type="number" min={1} value={cpu} onChange={(e) => setCpu(Number(e.target.value))} />
                    </FormField>
                    <FormField label="Memory (RAM)" error={errors.ram}>
                      <Select value={String(ramGb)} onValueChange={(v: any) => setRamGb(Number(v))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RAM_OPTIONS.map((gb) => (
                            <SelectItem key={gb} value={String(gb)}>
                              {gb} GB
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>

                  <FormField label="Disk Size (GB)" error={errors.storage}>
                    <Input type="number" min={minDisk} value={storageGb} onChange={(e) => setStorageGb(Number(e.target.value))} />
                  </FormField>
                </div>
              )}

              {/* STEP 4: Credentials & Final Review */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-base font-semibold text-foreground">Step 4: Credentials & Final Review</h3>
                    <p className="text-xs text-muted-foreground">Configure login access credentials and review VM deployment summary.</p>
                  </div>

                  {(isContainer || isCloud || isCustom) && (
                    <div className="space-y-4">
                      <FormField
                        label="SSH Public Key"
                        hint="Pasted output of cat ~/.ssh/id_ed25519.pub — required for SSH access."
                      >
                        <textarea
                          value={sshKey}
                          onChange={(e) => setSshKey(e.target.value)}
                          placeholder="ssh-ed25519 AAAA… you@laptop"
                          className="h-20 w-full resize-none rounded-md border bg-background p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                        />
                      </FormField>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {isCloud && (
                          <FormField label="Username">
                            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="debian" />
                          </FormField>
                        )}
                        <FormField
                          label={isContainer ? "Root Password" : "Password (optional)"}
                          hint={isContainer ? "Set container root password" : "SSH key is recommended"}
                        >
                          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </FormField>
                      </div>
                    </div>
                  )}

                  {/* Summary Card */}
                  <Card className="bg-muted/40 border border-primary/20">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                        <Sparkles className="size-4 text-primary" /> Deployment Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 text-xs font-mono space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-semibold text-foreground">{name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source:</span>
                        <span className="font-semibold text-foreground uppercase">{source}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hardware:</span>
                        <span className="font-semibold text-foreground">{cpu} vCPU · {ramGb} GB RAM · {storageGb} GB Disk</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Node:</span>
                        <span className="font-semibold text-foreground">{nodeChoice}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Wizard Navigation Footer Buttons */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1}>
                  <ArrowLeft className="size-4" /> Back
                </Button>

                {step < 4 ? (
                  <Button type="button" onClick={nextStep} disabled={!canProceed}>
                    Next Step <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button type="submit" variant="default" disabled={submitting || !canProceed}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                    Create Virtual Machine
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
