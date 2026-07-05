"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Command,
  Download,
  Eye,
  FileArchive,
  FileJson,
  FileSearch,
  FileText,
  GitBranch,
  History,
  Layers3,
  Link as LinkIcon,
  LucideIcon,
  MessageSquare,
  MousePointer2,
  Network,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Citation, DocumentChatResponse, RiskBrief, TraceEvent, chatWithDocuments, streamAssessmentTrace } from "../lib/api";

type VendorDraft = {
  id: string;
  name: string;
  soc2?: File;
  questionnaire?: File;
  breach?: File;
};

type AssessmentRecord = {
  id: string;
  createdAt: string;
  brief: RiskBrief;
};

type CollaborationItem = {
  id: string;
  author: string;
  action: "comment" | "approved" | "rejected" | "resolved";
  text: string;
  createdAt: string;
};

const storageKey = "vendor-risk-assessment-history";
const sharedReportPrefix = "vendor-risk-shared-report:";

function safeId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const createDraft = (): VendorDraft => ({
  id: safeId("draft"),
  name: "",
});

const fadeUp = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

const chaos = [
  ["PDFs", "150 pages to read", FileText],
  ["Questionnaires", "Claims to verify", ClipboardCheck],
  ["Email", "Answers in threads", MessageSquare],
  ["Slack", "Context disappears", Users],
  ["Meetings", "Decisions delayed", History],
  ["Spreadsheets", "Risk copied by hand", FileArchive],
] as const;

export default function LandingPage() {
  const [drafts, setDrafts] = useState<VendorDraft[]>([createDraft()]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [collaboration, setCollaboration] = useState<Record<string, CollaborationItem[]>>({});
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as AssessmentRecord[];
      setRecords(parsed);
      setActiveId(parsed[0]?.id ?? null);
      setSelectedCitation(parsed[0]?.brief.categories.flatMap((item) => item.citations)[0] ?? null);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeRecord = useMemo(
    () => records.find((record) => record.id === activeId) ?? records[0] ?? null,
    [activeId, records],
  );

  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setTrace([]);
    setLoading(true);
    setProgress(8);

    const validDrafts = drafts.filter((draft) => draft.name && draft.soc2 && draft.questionnaire);
    if (!validDrafts.length) {
      setError("Upload a SOC2 report and questionnaire to begin the assessment.");
      setLoading(false);
      setProgress(0);
      return;
    }

    try {
      const next: AssessmentRecord[] = [];
      for (const [index, draft] of validDrafts.entries()) {
        const formData = new FormData();
        formData.append("vendor_name", draft.name);
        formData.append("soc2_report", draft.soc2 as File);
        formData.append("questionnaire", draft.questionnaire as File);
        if (draft.breach) formData.append("breach_history", draft.breach);
        setPdfUrl(URL.createObjectURL(draft.soc2 as File));
        setProgress(Math.round((index / validDrafts.length) * 65) + 12);

        const brief = await streamAssessmentTrace(formData, (item) => {
          setTrace((current) => [...current, { ...item, message: `${draft.name}: ${item.message}` }]);
        });
        next.push({ id: safeId("assessment"), createdAt: new Date().toISOString(), brief });
      }

      setRecords((current) => [...next, ...current]);
      setActiveId(next[0]?.id ?? null);
      setSelectedCitation(next[0]?.brief.categories.flatMap((item) => item.citations)[0] ?? null);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed.");
    } finally {
      setLoading(false);
      window.setTimeout(() => setProgress(0), 1000);
    }
  }

  function updateDraft(id: string, patch: Partial<VendorDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function loadDemoMode() {
    const demo = createDemoRecord();
    setRecords((current) => [demo, ...current]);
    setActiveId(demo.id);
    setSelectedCitation(demo.brief.categories[0]?.citations[0] ?? null);
    setTrace([
      { step: "demo", message: "Loaded sample vendor documents." },
      { step: "plan", message: "Mapped SOC2, ISO27001, and GDPR control families." },
      { step: "retrieve", message: "Linked evidence to controls and questionnaire claims." },
      { step: "reason", message: "Calculated deterministic risk and assessment confidence." },
      { step: "complete", message: "Board-ready report generated." },
    ]);
  }

  function shareReport() {
    if (!activeRecord) return;
    const token = safeId("share");
    window.localStorage.setItem(`${sharedReportPrefix}${token}`, JSON.stringify(activeRecord));
    const url = new URL(window.location.href);
    url.pathname = `/report/${token}`;
    url.hash = "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).catch(() => undefined);
    }
    setShareStatus("Share link copied. The report opens as a printable consulting-style page.");
    window.setTimeout(() => setShareStatus(null), 4000);
  }

  function exportRecord(format: "pdf" | "markdown" | "json") {
    if (!activeRecord) return;
    if (format === "pdf") {
      window.print();
      return;
    }
    const content = format === "json" ? JSON.stringify(activeRecord.brief, null, 2) : toMarkdown(activeRecord.brief);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeRecord.brief.vendor_name.toLowerCase().replace(/\s+/g, "-")}-risk-report.${format === "json" ? "json" : "md"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addCollaborationItem(recordId: string, item: Omit<CollaborationItem, "id" | "createdAt">) {
    setCollaboration((current) => ({
      ...current,
      [recordId]: [{ ...item, id: safeId("activity"), createdAt: new Date().toISOString() }, ...(current[recordId] || [])],
    }));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-950">
      <CinematicHero />
      <ChaosSection />
      <PipelineSection />
      <ReasoningSection />
      <EvidenceGraphSection />
      <InteractiveReportSection />
      <TransformationSection />
      <AnimatedMetricsSection />
      <TrustSection />
      <CollaborationStorySection />
      <ChatStorySection />
      <ClosingSection />
    </main>
  );
}

export function ProductExperience({ title = "Vendor Risk Command Center", subtitle = "Run assessments, inspect evidence, chat with documents, share reports, and review history." }: { title?: string; subtitle?: string }) {
  const [drafts, setDrafts] = useState<VendorDraft[]>([createDraft()]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [collaboration, setCollaboration] = useState<Record<string, CollaborationItem[]>>({});
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as AssessmentRecord[];
      setRecords(parsed);
      setActiveId(parsed[0]?.id ?? null);
      setSelectedCitation(parsed[0]?.brief.categories.flatMap((item) => item.citations)[0] ?? null);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeRecord = useMemo(
    () => records.find((record) => record.id === activeId) ?? records[0] ?? null,
    [activeId, records],
  );

  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setTrace([]);
    setLoading(true);
    setProgress(8);

    const validDrafts = drafts.filter((draft) => draft.name && draft.soc2 && draft.questionnaire);
    if (!validDrafts.length) {
      setError("Upload a SOC2 report and questionnaire to begin the assessment.");
      setLoading(false);
      setProgress(0);
      return;
    }

    try {
      const next: AssessmentRecord[] = [];
      for (const [index, draft] of validDrafts.entries()) {
        const formData = new FormData();
        formData.append("vendor_name", draft.name);
        formData.append("soc2_report", draft.soc2 as File);
        formData.append("questionnaire", draft.questionnaire as File);
        if (draft.breach) formData.append("breach_history", draft.breach);
        setPdfUrl(URL.createObjectURL(draft.soc2 as File));
        setProgress(Math.round((index / validDrafts.length) * 65) + 12);

        const brief = await streamAssessmentTrace(formData, (item) => {
          setTrace((current) => [...current, { ...item, message: `${draft.name}: ${item.message}` }]);
        });
        next.push({ id: safeId("assessment"), createdAt: new Date().toISOString(), brief });
      }

      setRecords((current) => [...next, ...current]);
      setActiveId(next[0]?.id ?? null);
      setSelectedCitation(next[0]?.brief.categories.flatMap((item) => item.citations)[0] ?? null);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed.");
    } finally {
      setLoading(false);
      window.setTimeout(() => setProgress(0), 1000);
    }
  }

  function updateDraft(id: string, patch: Partial<VendorDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function loadDemoMode() {
    const demo = createDemoRecord();
    setRecords((current) => [demo, ...current]);
    setActiveId(demo.id);
    setSelectedCitation(demo.brief.categories[0]?.citations[0] ?? null);
    setTrace([
      { step: "demo", message: "Loaded sample vendor documents." },
      { step: "plan", message: "Mapped SOC2, ISO27001, and GDPR control families." },
      { step: "retrieve", message: "Linked evidence to controls and questionnaire claims." },
      { step: "reason", message: "Calculated deterministic risk and assessment confidence." },
      { step: "complete", message: "Board-ready report generated." },
    ]);
  }

  function shareReport() {
    if (!activeRecord) return;
    const token = safeId("share");
    window.localStorage.setItem(`${sharedReportPrefix}${token}`, JSON.stringify(activeRecord));
    const url = new URL(window.location.href);
    url.pathname = `/report/${token}`;
    url.hash = "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).catch(() => undefined);
    }
    setShareStatus("Share link copied. The report opens as a printable consulting-style page.");
    window.setTimeout(() => setShareStatus(null), 4000);
  }

  function exportRecord(format: "pdf" | "markdown" | "json") {
    if (!activeRecord) return;
    if (format === "pdf") {
      window.print();
      return;
    }
    const content = format === "json" ? JSON.stringify(activeRecord.brief, null, 2) : toMarkdown(activeRecord.brief);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeRecord.brief.vendor_name.toLowerCase().replace(/\s+/g, "-")}-risk-report.${format === "json" ? "json" : "md"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addCollaborationItem(recordId: string, item: Omit<CollaborationItem, "id" | "createdAt">) {
    setCollaboration((current) => ({
      ...current,
      [recordId]: [{ ...item, id: safeId("activity"), createdAt: new Date().toISOString() }, ...(current[recordId] || [])],
    }));
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <AppShell title={title} subtitle={subtitle}>
        <ProductCockpit
          activeRecord={activeRecord}
          addCollaborationItem={addCollaborationItem}
          collaboration={collaboration}
          commandOpen={commandOpen}
          drafts={drafts}
          error={error}
          exportRecord={exportRecord}
          loading={loading}
          loadDemoMode={loadDemoMode}
          pdfUrl={pdfUrl}
          progress={progress}
          records={records}
          selectedCitation={selectedCitation}
          setActiveId={setActiveId}
          setCommandOpen={setCommandOpen}
          setDrafts={setDrafts}
          setSelectedCitation={setSelectedCitation}
          shareReport={shareReport}
          shareStatus={shareStatus}
          submitAssessment={submitAssessment}
          trace={trace}
          updateDraft={updateDraft}
        />
      </AppShell>
    </main>
  );
}

function CinematicHero() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useTransform(mouseX, [-400, 400], ["35%", "65%"]);
  const glowY = useTransform(mouseY, [-400, 400], ["30%", "65%"]);

  return (
    <section
      className="relative flex min-h-screen items-center px-5 py-20 md:px-10"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        mouseX.set(event.clientX - rect.left - rect.width / 2);
        mouseY.set(event.clientY - rect.top - rect.height / 2);
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: useTransform([glowX, glowY], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(37,99,235,0.20), transparent 34rem)`),
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(79,70,229,0.14),transparent_24rem),linear-gradient(180deg,#f8fafc_0%,#eef6ff_48%,#ffffff_100%)]" />
      <ParticleField />
      <FloatingDocuments />
      <div className="relative z-10 mx-auto max-w-7xl">
        <motion.p initial={false} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">
          Vendor Risk Assessment Platform
        </motion.p>
        <motion.h1
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-8 max-w-6xl text-6xl font-semibold leading-[0.9] tracking-[-0.08em] text-slate-950 md:text-8xl lg:text-[8.5rem]"
        >
          You don't approve vendors.
          <span className="block bg-gradient-to-r from-blue-700 via-indigo-600 to-slate-950 bg-clip-text text-transparent">
            You approve trust.
          </span>
        </motion.h1>
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-8 max-w-2xl text-2xl leading-9 tracking-[-0.03em] text-slate-600"
        >
          Every vendor claims they're secure. Evidence tells the truth.
        </motion.p>
        <motion.a
          href="/app"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="btn-primary mt-10"
        >
          Start Assessment <ArrowRight className="h-4 w-4" />
        </motion.a>
      </div>
    </section>
  );
}

function FloatingDocuments() {
  const docs = [
    ["SOC2.pdf", "left-[8%] top-[18%] rotate-[-8deg]"],
    ["Questionnaire.csv", "right-[10%] top-[22%] rotate-[7deg]"],
    ["Breach history", "left-[18%] bottom-[16%] rotate-[5deg]"],
    ["Security email", "right-[18%] bottom-[18%] rotate-[-6deg]"],
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {docs.map(([label, position], index) => (
        <motion.div
          key={label}
          className={`absolute hidden rounded-[1.5rem] border border-white/70 bg-white/70 p-5 shadow-2xl shadow-blue-100/70 backdrop-blur-xl md:block ${position}`}
          animate={{ y: [0, -18, 0], rotate: index % 2 ? [4, 7, 4] : [-6, -9, -6] }}
          transition={{ duration: 7, repeat: Infinity, delay: index * 0.32 }}
        >
          <FileText className="h-5 w-5 text-blue-600" />
          <p className="mt-8 text-sm font-semibold text-slate-700">{label}</p>
        </motion.div>
      ))}
    </div>
  );
}

function ParticleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 26 }).map((_, index) => (
        <motion.span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-blue-400/35"
          style={{ left: `${(index * 37) % 100}%`, top: `${(index * 53) % 100}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.15, 0.65, 0.15] }}
          transition={{ duration: 5 + (index % 4), repeat: Infinity, delay: index * 0.12 }}
        />
      ))}
    </div>
  );
}

function ChaosSection() {
  return (
    <StorySection eyebrow="The current process" title="A purchase turns into a security scavenger hunt.">
      <div className="relative mt-20 min-h-[680px] rounded-[3rem] bg-gradient-to-b from-white to-slate-50 p-8 shadow-inner">
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200 bg-amber-50 p-6 text-center shadow-xl">
          <ClockLabel />
        </div>
        {chaos.map(([label, body, Icon], index) => {
          const positions = [
            "left-[7%] top-[8%]",
            "left-[46%] top-[4%]",
            "right-[8%] top-[20%]",
            "left-[10%] bottom-[18%]",
            "left-[43%] bottom-[6%]",
            "right-[10%] bottom-[18%]",
          ];
          return (
            <motion.div
              key={label}
              className={`absolute w-56 rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-200/80 backdrop-blur ${positions[index]}`}
              initial={false}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, delay: index * 0.22 }}
            >
              <Icon className="h-5 w-5 text-slate-400" />
              <p className="mt-10 text-xl font-semibold tracking-[-0.04em] text-slate-950">{label}</p>
              <p className="mt-2 text-sm text-slate-500">{body}</p>
            </motion.div>
          );
        })}
      </div>
    </StorySection>
  );
}

function ClockLabel() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <History className="h-7 w-7 text-amber-600" />
      <p className="mt-3 text-sm font-semibold text-amber-900">Approval waits</p>
      <p className="mt-1 text-xs text-amber-700">Business slows down</p>
    </div>
  );
}

function PipelineSection() {
  const stages = ["SOC2", "Questionnaire", "Breach History", "Framework Mapping", "Evidence Retrieval", "Reasoning Engine", "Deterministic Scoring", "Executive Report"];
  return (
    <StorySection eyebrow="The platform" title="The documents become a decision pipeline.">
      <div className="relative mt-16 overflow-hidden rounded-[3rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="absolute left-12 right-12 top-1/2 h-1 rounded-full bg-blue-100" />
        <motion.div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-blue-600 shadow-[0_0_36px_rgba(37,99,235,0.8)]"
          animate={{ left: ["3rem", "calc(100% - 3rem)"] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative grid gap-4 md:grid-cols-4">
          {stages.map((stage, index) => (
            <motion.div
              key={stage}
              className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur"
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06 }}
            >
              <p className="text-xs font-semibold text-blue-600">0{index + 1}</p>
              <p className="mt-10 font-semibold text-slate-950">{stage}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </StorySection>
  );
}

function ReasoningSection() {
  const steps = ["Planning review...", "Reading SOC2...", "Extracting controls...", "Finding contradictions...", "Matching evidence...", "Calculating confidence...", "Generating executive summary..."];
  return (
    <StorySection eyebrow="Live reasoning" title="It thinks in evidence, not guesses.">
      <div className="mx-auto mt-16 max-w-4xl rounded-[2.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-300">
        {steps.map((step, index) => (
          <motion.div
            key={step}
            className="mb-3 flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 last:mb-0"
            initial={false}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.09 }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
              {index < 5 ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </span>
            <span className="text-sm font-medium text-slate-100">{step}</span>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}

function EvidenceGraphSection() {
  const nodes = [
    { label: "Evidence", detail: "Source excerpts", x: 50, y: 50, primary: true },
    { label: "SOC2", detail: "Audit pages", x: 18, y: 22 },
    { label: "ISO 27001", detail: "Mapped controls", x: 79, y: 20 },
    { label: "GDPR", detail: "Data obligations", x: 20, y: 78 },
    { label: "Recommendations", detail: "Action plan", x: 79, y: 76 },
    { label: "Controls", detail: "CC6 · CC7 · A1", x: 50, y: 15 },
    { label: "Confidence", detail: "Explained score", x: 50, y: 86 },
    { label: "Questionnaire", detail: "Vendor claims", x: 9, y: 50 },
    { label: "Breach history", detail: "External signals", x: 91, y: 50 },
  ];
  const links = nodes.filter((node) => !node.primary).map((node) => [50, 50, node.x, node.y]);
  return (
    <StorySection eyebrow="Evidence graph" title="Controls, evidence, frameworks, and recommendations stay connected.">
      <div className="relative mt-16 min-h-[680px] overflow-hidden rounded-[3rem] border border-slate-200 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.16),transparent_22rem),linear-gradient(135deg,#ffffff,#eff6ff)] p-8 shadow-2xl shadow-blue-100/70">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_center,rgba(37,99,235,0.18)_1px,transparent_1px)] [background-size:28px_28px]" />
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="graphLine" x1="0" x2="1">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#2563EB" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          {links.map(([x1, y1, x2, y2], index) => (
            <motion.line
              key={index}
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke="url(#graphLine)"
              strokeWidth="2.4"
              strokeDasharray="10 12"
              initial={{ pathLength: 1, opacity: 0.95 }}
              whileInView={{ pathLength: 1, opacity: 0.95 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.07, duration: 1.1 }}
            />
          ))}
          {links.map(([, , x2, y2], index) => (
            <motion.circle
              key={`pulse-${index}`}
              r="4"
              fill="#2563EB"
              initial={{ cx: "50%", cy: "50%", opacity: 0 }}
              animate={{ cx: [`50%`, `${x2}%`], cy: [`50%`, `${y2}%`], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.28, ease: "easeInOut" }}
            />
          ))}
        </svg>
        {nodes.map((node, index) => (
          <motion.button
            key={node.label}
            className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-[1.35rem] border px-5 py-4 text-left shadow-xl backdrop-blur-xl transition hover:scale-105 ${
              node.primary
                ? "border-blue-500 bg-blue-600 text-white shadow-blue-300/70"
                : "border-white/80 bg-white/85 text-slate-950 shadow-slate-200/80"
            }`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            initial={false}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.07 }}
            type="button"
          >
            <span className="block text-sm font-semibold">{node.label}</span>
            <span className={`mt-1 block max-h-0 overflow-hidden text-xs transition-all group-hover:max-h-8 ${node.primary ? "text-blue-100" : "text-slate-500"}`}>
              {node.detail}
            </span>
          </motion.button>
        ))}
      </div>
    </StorySection>
  );
}

function InteractiveReportSection() {
  const [open, setOpen] = useState("Executive Summary");
  const sections = ["Executive Summary", "Evidence", "Charts", "Timeline", "Recommendations"];
  return (
    <StorySection eyebrow="Report" title="A report that behaves like a product.">
      <div className="mx-auto mt-16 max-w-5xl rounded-[3rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/70">
        <div className="grid gap-4 md:grid-cols-[0.35fr_0.65fr]">
          <div className="grid gap-2">
            {sections.map((section) => (
              <button
                key={section}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${open === section ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-blue-50"}`}
                onClick={() => setOpen(section)}
                type="button"
              >
                {section}
              </button>
            ))}
          </div>
          <motion.div key={open} initial={false} animate={{ opacity: 1, y: 0 }} className="min-h-80 rounded-[2rem] bg-gradient-to-br from-slate-50 to-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">{open}</p>
            <h3 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-slate-950">Board-ready, cited, and printable.</h3>
            <div className="mt-8 grid gap-3">
              {["Overall risk", "Assessment confidence", "Supporting evidence", "Recommended decision"].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </StorySection>
  );
}

function TransformationSection() {
  return (
    <StorySection eyebrow="Transformation" title="Manual review becomes verified trust.">
      <div className="mt-16 grid gap-6 md:grid-cols-2">
        <TransformationColumn title="Manual Review" items={["Weeks", "Meetings", "PDFs", "Emails", "Unclear risk"]} muted />
        <TransformationColumn title="Vendor Risk Agent" items={["Minutes", "Evidence", "Confidence", "Decision", "Cited report"]} />
      </div>
    </StorySection>
  );
}

function TransformationColumn({ items, muted = false, title }: { items: string[]; muted?: boolean; title: string }) {
  return (
    <div className={`rounded-[3rem] border p-8 ${muted ? "border-slate-200 bg-white/60" : "border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-600/20"}`}>
      <h3 className="text-4xl font-semibold tracking-[-0.05em]">{title}</h3>
      <div className="mt-8 grid gap-3">
        {items.map((item, index) => (
          <motion.div
            key={item}
            className={`rounded-2xl p-4 text-sm font-semibold ${muted ? "bg-slate-50 text-slate-600" : "bg-white/15 text-white ring-1 ring-white/20"}`}
            initial={false}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.06 }}
          >
            {item}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AnimatedMetricsSection() {
  const panels = [
    {
      title: "Risk evolution",
      eyebrow: "Risk",
      tone: "blue",
      points: "4,72 20,64 36,58 52,43 68,38 84,31 96,28",
      caption: "Risk becomes legible as evidence is linked.",
    },
    {
      title: "Confidence growth",
      eyebrow: "Confidence",
      tone: "indigo",
      points: "4,78 18,70 32,61 48,50 62,39 80,29 96,24",
      caption: "Direct citations raise assessment confidence.",
    },
    {
      title: "Framework coverage",
      eyebrow: "Coverage",
      tone: "emerald",
      bars: [42, 68, 76, 88],
      caption: "Mapped controls show what is covered.",
    },
    {
      title: "Evidence completeness",
      eyebrow: "Evidence",
      tone: "amber",
      rings: [82, 64, 48],
      caption: "Missing proof is visible, not hidden.",
    },
  ];
  return (
    <StorySection eyebrow="Metrics" title="Risk, confidence, and evidence move as the review gets clearer.">
      <div className="mt-16 grid gap-5 md:grid-cols-2">
        {panels.map((panel, index) => (
          <MetricPanel key={panel.title} panel={panel} delay={index * 0.08} />
        ))}
      </div>
      <div className="mt-5 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Assessment timeline</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">From upload to decision, every step is visible.</h3>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">This is not a static dashboard screenshot. The timeline animates the review becoming progressively more grounded.</p>
        </div>
        <div className="relative mt-8 grid gap-3 md:grid-cols-5">
          <div className="absolute left-6 right-6 top-7 hidden h-px bg-gradient-to-r from-blue-100 via-blue-400 to-indigo-200 md:block" />
          {["Upload", "Parse", "Match", "Score", "Decide"].map((step, index) => (
            <motion.div
              key={step}
              className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center shadow-sm"
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shadow-lg shadow-blue-200">{index + 1}</span>
              <p className="mt-4 text-sm font-semibold text-slate-800">{step}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </StorySection>
  );
}

function MetricPanel({
  delay,
  panel,
}: {
  delay: number;
  panel: {
    title: string;
    eyebrow: string;
    tone: string;
    points?: string;
    bars?: number[];
    rings?: number[];
    caption: string;
  };
}) {
  const stroke = panel.tone === "emerald" ? "#16A34A" : panel.tone === "amber" ? "#F59E0B" : panel.tone === "indigo" ? "#4F46E5" : "#2563EB";
  return (
    <motion.div
      className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60"
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{panel.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{panel.title}</h3>
        </div>
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stroke, boxShadow: `0 0 24px ${stroke}66` }} />
      </div>
      <div className="mt-8 h-52 rounded-[2rem] bg-gradient-to-b from-slate-50 to-white p-5">
        {panel.points ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id={`${panel.tone}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.polyline
              points={panel.points}
              fill="none"
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 1 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, delay }}
            />
            <polygon points={`4,100 ${panel.points} 96,100`} fill={`url(#${panel.tone}-fill)`} />
          </svg>
        ) : panel.bars ? (
          <div className="flex h-full items-end gap-4">
            {panel.bars.map((bar, index) => (
              <div key={bar} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex h-36 w-full items-end rounded-full bg-slate-100 p-1">
                  <motion.div
                    className="w-full rounded-full"
                    style={{ backgroundColor: stroke }}
                    initial={{ height: `${bar}%` }}
                    whileInView={{ height: `${bar}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: delay + index * 0.08 }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-400">Q{index + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center gap-5">
            {panel.rings?.map((ring, index) => (
              <svg key={ring} viewBox="0 0 120 120" className="h-28 w-28">
                <circle cx="60" cy="60" r="44" fill="none" stroke="#E5E7EB" strokeWidth="12" />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke={stroke}
                  strokeLinecap="round"
                  strokeWidth="12"
                  strokeDasharray={276}
                  initial={{ strokeDashoffset: 276 - (ring / 100) * 276 }}
                  whileInView={{ strokeDashoffset: 276 - (ring / 100) * 276 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, delay: delay + index * 0.1 }}
                  transform="rotate(-90 60 60)"
                />
              </svg>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">{panel.caption}</p>
    </motion.div>
  );
}

function TrustSection() {
  const trust = ["Every score has evidence.", "Every recommendation has citations.", "Every confidence score has an explanation.", "Every control links back to documentation.", "Everything is deterministic.", "Nothing is hallucinated."];
  return (
    <StorySection eyebrow="Trust" title="Trust is engineered into the output.">
      <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trust.map((item, index) => (
          <motion.div key={item} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm" initial={false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
            <BadgeCheck className="h-5 w-5 text-blue-600" />
            <p className="mt-10 text-xl font-semibold tracking-[-0.04em] text-slate-950">{item}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}

function CollaborationStorySection() {
  return (
    <StorySection eyebrow="Collaboration" title="The review becomes a team workflow.">
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {["Share report", "Comment", "Assign reviewer", "Approve", "Reject", "Audit trail"].map((item, index) => (
          <motion.div key={item} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm" animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, delay: index * 0.16 }}>
            <Users className="h-5 w-5 text-blue-600" />
            <p className="mt-12 text-xl font-semibold text-slate-950">{item}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}

function ChatStorySection() {
  return (
    <StorySection eyebrow="AI Chat with Documents" title="Ask the evidence directly.">
      <div className="mx-auto mt-16 max-w-4xl rounded-[3rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/70">
        <div className="grid gap-4">
          {["Where is MFA mentioned?", "Summarize encryption.", "Show backup policy.", "Which controls failed?", "Why is confidence only 84%?"].map((question) => (
            <div key={question} className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {question}
            </div>
          ))}
          <div className="ml-auto max-w-2xl rounded-[2rem] bg-blue-600 p-5 text-white">
            The answer links back to the exact PDF page and highlights the paragraph used.
            <div className="mt-4 rounded-2xl bg-white/15 p-3 text-sm">Citation: SOC2 page 12 · Access controls</div>
          </div>
        </div>
      </div>
    </StorySection>
  );
}

function StorySection({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-10">
      <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: "-120px" }} variants={fadeUp} className="max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">{eyebrow}</p>
        <h2 className="mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.065em] text-slate-950 md:text-7xl">
          {title}
        </h2>
      </motion.div>
      {children}
    </section>
  );
}

function ClosingSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 px-5 py-32 text-white md:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.38),transparent_32rem)]" />
      <div className="relative mx-auto max-w-7xl">
        <h2 className="max-w-5xl text-6xl font-semibold leading-[0.9] tracking-[-0.075em] md:text-8xl">
          Trust isn't claimed.
          <span className="block text-blue-200">It's verified.</span>
        </h2>
        <p className="mt-8 max-w-xl text-xl leading-8 text-slate-300">Know the risk before you sign.</p>
        <a href="/app" className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950">
          Run your first assessment <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}

function ProductCockpit(props: {
  activeRecord: AssessmentRecord | null;
  addCollaborationItem: (recordId: string, item: Omit<CollaborationItem, "id" | "createdAt">) => void;
  collaboration: Record<string, CollaborationItem[]>;
  commandOpen: boolean;
  drafts: VendorDraft[];
  error: string | null;
  exportRecord: (format: "pdf" | "markdown" | "json") => void;
  loading: boolean;
  loadDemoMode: () => void;
  pdfUrl: string | null;
  progress: number;
  records: AssessmentRecord[];
  selectedCitation: Citation | null;
  setActiveId: (id: string) => void;
  setCommandOpen: (open: boolean) => void;
  setDrafts: (drafts: VendorDraft[] | ((current: VendorDraft[]) => VendorDraft[])) => void;
  setSelectedCitation: (citation: Citation) => void;
  shareReport: () => void;
  shareStatus: string | null;
  submitAssessment: (event: FormEvent<HTMLFormElement>) => void;
  trace: TraceEvent[];
  updateDraft: (id: string, patch: Partial<VendorDraft>) => void;
}) {
  return (
    <section id="product" className="mx-auto max-w-7xl px-5 py-28 md:px-10">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Product cockpit</p>
          <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
            Run the assessment.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Upload documents, watch the reasoning trace, chat with evidence, collaborate, share the report, and export the decision.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => props.setCommandOpen(true)} type="button">
          <Command className="h-4 w-4" /> Command palette
        </button>
      </div>
      <CommandPalette open={props.commandOpen} setOpen={props.setCommandOpen} loadDemoMode={props.loadDemoMode} shareReport={props.shareReport} />
      <ProductDashboard records={props.records} activeRecord={props.activeRecord} />
      <div className="mt-8 grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
        <UploadConsole {...props} />
        <AssessmentConsole {...props} />
      </div>
      <ComparisonAndHistory records={props.records} setActiveId={props.setActiveId} />
    </section>
  );
}

function AppShell({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  const nav = [
    ["/app", "Dashboard", Activity],
    ["/assess", "Assess", UploadCloud],
    ["/chat", "AI Chat", MessageSquare],
    ["/frameworks", "Frameworks", Layers3],
    ["/history", "History", History],
    ["/settings", "Settings", Command],
  ] as const;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 p-4 backdrop-blur-xl lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">Vendor Risk</p>
            <p className="text-xs text-slate-500">Enterprise AI review</p>
          </div>
        </div>
        <nav className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
          {nav.map(([href, label, Icon]) => (
            <a key={href} href={href} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <div>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-5 py-4 backdrop-blur-xl lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4" />
                Search reports
              </div>
              <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" type="button">
                Notifications
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function ProductDashboard({ activeRecord, records }: { activeRecord: AssessmentRecord | null; records: AssessmentRecord[] }) {
  const metrics = useMemo(() => buildMetrics(records), [records]);
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Metric label="Risk Score" value={activeRecord ? `${activeRecord.brief.overall_risk_score}/100` : "No assessment"} />
      <Metric label="Approval Recommendation" value={activeRecord ? recommendation(activeRecord.brief) : "Run assessment"} />
      <Metric label="Assessment Confidence" value={activeRecord ? `${Math.round(activeRecord.brief.confidence_score * 100)}%` : "No data"} />
      <Metric label="Critical Findings" value={activeRecord ? String(activeRecord.brief.flagged_gaps.length) : "0"} />
      <Metric label="Framework Coverage" value={`${metrics.frameworkCoverage}%`} />
      <Metric label="Review Status" value={activeRecord ? "Decision ready" : "Awaiting upload"} />
    </div>
  );
}

function UploadConsole({
  drafts,
  error,
  loading,
  loadDemoMode,
  progress,
  setDrafts,
  submitAssessment,
  trace,
  updateDraft,
}: Parameters<typeof ProductCockpit>[0]) {
  return (
    <GlassPanel>
      <PanelHeader icon={UploadCloud} title="Upload documents" body="Drag in one or more vendor packages. Demo Mode loads a complete sample instantly." />
      <form className="mt-6 grid gap-4" onSubmit={submitAssessment}>
        {drafts.map((draft, index) => (
          <VendorUploadRow key={draft.id} draft={draft} index={index} updateDraft={updateDraft} />
        ))}
        <div className="grid gap-3 sm:grid-cols-3">
          <button className="btn-secondary justify-center" type="button" onClick={() => setDrafts((current) => [...current, createDraft()])}>
            <Plus className="h-4 w-4" /> Add vendor
          </button>
          <button className="btn-secondary justify-center" type="button" onClick={loadDemoMode}>
            <Sparkles className="h-4 w-4" /> Demo Mode
          </button>
          <button className="btn-primary justify-center" disabled={loading} type="submit">
            {loading ? "Analyzing" : "Run assessment"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {progress ? <Progress label="Assessment progress" value={progress} /> : null}
        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      </form>
      <ReasoningTrace trace={trace} loading={loading} />
    </GlassPanel>
  );
}

function AssessmentConsole(props: Parameters<typeof ProductCockpit>[0]) {
  const record = props.activeRecord;
  if (!record) {
    return (
      <GlassPanel>
        <EmptyState
          icon={FileSearch}
          title="No assessment selected"
          body="Run Demo Mode or upload documents to generate an executive dashboard, evidence explorer, document chat, collaboration feed, and report exports."
          action={<button className="btn-primary" onClick={props.loadDemoMode} type="button">Launch Demo Mode</button>}
        />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel>
      <DecisionReport record={record} shareReport={props.shareReport} shareStatus={props.shareStatus} exportRecord={props.exportRecord} />
      <div className="mt-6 grid gap-4">
        <Expandable title="Evidence explorer" icon={Network} defaultOpen>
          <EvidenceExplorer brief={record.brief} selectedCitation={props.selectedCitation} setSelectedCitation={props.setSelectedCitation} />
          <CitationPreview citation={props.selectedCitation} pdfUrl={props.pdfUrl} />
        </Expandable>
        <Expandable title="AI Chat with documents" icon={MessageSquare} defaultOpen>
          <DocumentChat brief={record.brief} selectedCitation={props.selectedCitation} setSelectedCitation={props.setSelectedCitation} />
        </Expandable>
        <Expandable title="Smart follow-up questions" icon={ClipboardCheck}>
          <SmartQuestions brief={record.brief} />
        </Expandable>
        <Expandable title="Collaboration and activity" icon={Users}>
          <CollaborationPanel
            items={props.collaboration[record.id] || []}
            onAdd={(item) => props.addCollaborationItem(record.id, item)}
            record={record}
          />
        </Expandable>
      </div>
    </GlassPanel>
  );
}

function DecisionReport({
  exportRecord,
  record,
  shareReport,
  shareStatus,
}: {
  exportRecord: (format: "pdf" | "markdown" | "json") => void;
  record: AssessmentRecord;
  shareReport: () => void;
  shareStatus: string | null;
}) {
  const brief = record.brief;
  return (
    <div className="rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-blue-600/20">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">Board-ready report</p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{brief.vendor_name}</h3>
          <p className="mt-3 max-w-2xl text-blue-50">{recommendation(brief)}.</p>
        </div>
        <RiskPill level={brief.overall_risk_level} score={brief.overall_risk_score} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <ReportMini label="Risk" value={`${brief.overall_risk_score}/100`} />
        <ReportMini label="Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
        <ReportMini label="Findings" value={String(brief.flagged_gaps.length)} />
        <ReportMini label="Frameworks" value={brief.plan.frameworks.join(", ")} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700" onClick={shareReport} type="button">
          <LinkIcon className="mr-2 inline h-4 w-4" /> Share Report
        </button>
        <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20" onClick={() => exportRecord("pdf")} type="button">Executive PDF</button>
        <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20" onClick={() => exportRecord("markdown")} type="button">Markdown</button>
        <button className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20" onClick={() => exportRecord("json")} type="button">JSON</button>
      </div>
      {shareStatus ? <div className="mt-4 rounded-2xl bg-white/15 px-4 py-3 text-sm text-blue-50">{shareStatus}</div> : null}
    </div>
  );
}

function VendorUploadRow({ draft, index, updateDraft }: { draft: VendorDraft; index: number; updateDraft: (id: string, patch: Partial<VendorDraft>) => void }) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-sm">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Vendor {index + 1}
        <input
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
          placeholder="Vendor name"
          value={draft.name}
        />
      </label>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <FileDrop label="SOC2 PDF" accept="application/pdf" file={draft.soc2} onFile={(file) => updateDraft(draft.id, { soc2: file })} />
        <FileDrop label="Questionnaire" accept=".json,.csv" file={draft.questionnaire} onFile={(file) => updateDraft(draft.id, { questionnaire: file })} />
        <FileDrop label="Breach History" accept=".txt,.md,.json,.csv" file={draft.breach} onFile={(file) => updateDraft(draft.id, { breach: file })} />
      </div>
    </div>
  );
}

function FileDrop({ accept, file, label, onFile }: { accept: string; file?: File; label: string; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      className="group rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
      onClick={() => ref.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) onFile(dropped);
      }}
      type="button"
    >
      <input ref={ref} className="hidden" type="file" accept={accept} onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        if (selected) onFile(selected);
      }} />
      <UploadCloud className="h-5 w-5 text-blue-600" />
      <p className="mt-4 text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{file ? file.name : "Drop or browse"}</p>
    </button>
  );
}

function ReasoningTrace({ loading, trace }: { loading: boolean; trace: TraceEvent[] }) {
  const fallback = [
    "Reading SOC2 report",
    "Extracting controls",
    "Matching questionnaire",
    "Searching breach history",
    "Computing deterministic risk",
    "Generating executive summary",
  ];
  return (
    <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-950">Live AI analysis</p>
        <span className="text-xs text-slate-500">{loading ? "Running" : "Ready"}</span>
      </div>
      <div className="mt-4 grid gap-2">
        {(trace.length ? trace.map((item) => item.message) : fallback).map((item, index) => (
          <motion.div key={`${item}-${index}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700" initial={false} animate={{ opacity: 1, y: 0 }}>
            <CheckCircle2 className={`h-4 w-4 ${trace.length || index < 1 ? "text-green-600" : "text-slate-300"}`} />
            {item}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EvidenceExplorer({ brief, selectedCitation, setSelectedCitation }: { brief: RiskBrief; selectedCitation: Citation | null; setSelectedCitation: (citation: Citation) => void }) {
  return (
    <div className="grid gap-3">
      {brief.categories.map((finding) => (
        <div key={finding.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold capitalize text-slate-950">{finding.category.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{finding.rationale}</p>
            </div>
            <RiskPill level={finding.status === "gap" ? "high" : finding.status === "review" ? "medium" : "low"} score={finding.score} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {finding.citations.map((citation, index) => (
              <button
                key={`${citation.source}-${citation.location}-${index}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedCitation?.quote === citation.quote ? "bg-blue-600 text-white" : "bg-white text-blue-700 ring-1 ring-blue-100"}`}
                onClick={() => setSelectedCitation(citation)}
                type="button"
              >
                {citation.source} · {citation.location}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CitationPreview({ citation, pdfUrl }: { citation: Citation | null; pdfUrl: string | null }) {
  const [search, setSearch] = useState("");
  const page = citation?.location.match(/\d+/)?.[0];
  const src = pdfUrl && page ? `${pdfUrl}#page=${page}` : pdfUrl;
  return (
    <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="font-semibold text-slate-950">PDF evidence</p>
        <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input className="bg-transparent outline-none" placeholder="Search uploaded evidence" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {citation ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.22fr_0.78fr]">
          <div className="grid gap-2">
            {[page ?? "1", String(Number(page ?? "1") + 1), String(Number(page ?? "1") + 2)].map((item, index) => (
              <a key={`${item}-${index}`} href={pdfUrl ? `${pdfUrl}#page=${item}` : undefined} className={`rounded-2xl border px-3 py-3 text-xs font-semibold ${index === 0 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                Page {item}
              </a>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">{citation.source} · {citation.location}</p>
              <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700">{highlightSearch(citation.quote, search)}</p>
              <p className="mt-3 text-xs font-semibold text-blue-700">This paragraph contributed to scoring and confidence.</p>
            </div>
            <div className="min-h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {src ? <iframe title="PDF citation preview" src={src} className="h-72 w-full" /> : <div className="flex h-72 items-center justify-center p-6 text-center text-sm text-slate-500">Upload a PDF in this session to preview pages.</div>}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState icon={Eye} title="Select evidence to inspect" body="Click a citation to jump to the source page, highlight the paragraph, and understand how it affected the score." />
      )}
    </div>
  );
}

function DocumentChat({ brief, selectedCitation, setSelectedCitation }: { brief: RiskBrief; selectedCitation: Citation | null; setSelectedCitation: (citation: Citation) => void }) {
  const [question, setQuestion] = useState("Where is MFA mentioned?");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; citations?: Citation[]; provider?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const citations = useMemo(() => allCitations(brief), [brief]);
  const prompts = ["Where is MFA mentioned?", "Summarize encryption.", "Show backup policy.", "Which controls failed?", "Why is confidence only 84%?"];

  async function ask(input = question) {
    if (!input.trim()) return;
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: input }]);
    try {
      const response: DocumentChatResponse = await chatWithDocuments({ question: input, citations, vendor_name: brief.vendor_name });
      setMessages((current) => [...current, { role: "assistant", content: response.answer, citations: response.citations, provider: response.provider }]);
      if (response.citations[0]) setSelectedCitation(response.citations[0]);
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Document chat failed." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => ask(prompt)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700">
            {prompt}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-auto rounded-[1.5rem] border border-slate-200 bg-white p-4">
        {messages.length ? messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`mb-3 rounded-2xl p-4 text-sm leading-6 last:mb-0 ${message.role === "user" ? "ml-8 bg-blue-600 text-white" : "mr-8 bg-slate-50 text-slate-700"}`}>
            {message.content}
            {message.provider ? <p className="mt-2 text-xs opacity-70">Provider: {message.provider}</p> : null}
            {message.citations?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.citations.map((citation, citationIndex) => <button key={`${citation.source}-${citationIndex}`} type="button" onClick={() => setSelectedCitation(citation)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">{citation.source} · {citation.location}</button>)}</div> : null}
          </div>
        )) : <EmptyState icon={MessageSquare} title="Chat with uploaded evidence" body="Ask questions about MFA, encryption, backups, missing controls, or confidence. Answers include citations." />}
      </div>
      <div className="flex gap-2">
        <input className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") ask(); }} />
        <button className="btn-primary" disabled={loading} type="button" onClick={() => ask()}>
          <Send className="h-4 w-4" /> {loading ? "Asking" : "Ask"}
        </button>
      </div>
      {selectedCitation ? <p className="text-xs text-slate-500">Highlighted citation: {selectedCitation.source} · {selectedCitation.location}</p> : null}
    </div>
  );
}

function SmartQuestions({ brief }: { brief: RiskBrief }) {
  const groups = smartFollowUpGroups(brief);
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <div key={group.role} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">{group.role}</p>
          <div className="mt-3 grid gap-2">
            {group.questions.map((question) => <div key={question} className="rounded-2xl bg-white p-3 text-sm leading-6 text-slate-700">{question}</div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollaborationPanel({ items, onAdd, record }: { items: CollaborationItem[]; onAdd: (item: Omit<CollaborationItem, "id" | "createdAt">) => void; record: AssessmentRecord }) {
  const [note, setNote] = useState(`@security please review ${record.brief.vendor_name}'s open findings.`);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <button className="btn-secondary justify-center" onClick={() => onAdd({ action: "approved", author: "You", text: "Approved for procurement review." })} type="button"><Check className="h-4 w-4" /> Approve</button>
        <button className="btn-secondary justify-center" onClick={() => onAdd({ action: "rejected", author: "You", text: "Rejected pending remediation evidence." })} type="button"><X className="h-4 w-4" /> Reject</button>
        <button className="btn-secondary justify-center" onClick={() => onAdd({ action: "resolved", author: "You", text: "Finding marked resolved after evidence review." })} type="button"><CheckCircle2 className="h-4 w-4" /> Resolve</button>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <input className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" value={note} onChange={(event) => setNote(event.target.value)} />
        <button className="btn-primary" onClick={() => { if (note.trim()) { onAdd({ action: "comment", author: "You", text: note }); setNote(""); } }} type="button">Add comment</button>
      </div>
      <div className="grid gap-3">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize text-slate-950">{item.action} · {item.author}</p>
              <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.text}</p>
          </div>
        )) : <EmptyState icon={Users} title="No collaboration yet" body="Comment, mention teammates, approve, reject, or resolve findings. Activity becomes part of the review trail." />}
      </div>
    </div>
  );
}

function ComparisonAndHistory({ records, setActiveId }: { records: AssessmentRecord[]; setActiveId: (id: string) => void }) {
  const safest = records.length ? records.reduce((best, record) => record.brief.overall_risk_score < best.brief.overall_risk_score ? record : best) : null;
  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <GlassPanel>
        <PanelHeader icon={MousePointer2} title="Vendor comparison" body="Compare risk, evidence, confidence, missing documents, and recommendation." />
        {records.length ? (
          <div className="mt-5 grid gap-3">
            {safest ? <StateMessage tone="success">Safer vendor based on current evidence: {safest.brief.vendor_name}</StateMessage> : null}
            {records.slice(0, 4).map((record) => <VendorScorecard key={record.id} record={record} setActiveId={setActiveId} />)}
          </div>
        ) : <EmptyState icon={MousePointer2} title="No vendors to compare" body="Run two assessments or use Demo Mode to compare vendors side by side." />}
      </GlassPanel>
      <GlassPanel>
        <PanelHeader icon={History} title="Saved assessments" body="Risk history, confidence history, recent decisions, and activity." />
        {records.length ? (
          <div className="mt-5 grid gap-3">
            {records.slice(0, 6).map((record) => <button key={record.id} onClick={() => setActiveId(record.id)} type="button" className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"><p className="font-semibold text-slate-950">{record.brief.vendor_name}</p><p className="mt-1 text-sm text-slate-500">{new Date(record.createdAt).toLocaleString()} · {record.brief.overall_risk_level} risk · {Math.round(record.brief.confidence_score * 100)}% confidence</p></button>)}
          </div>
        ) : <EmptyState icon={History} title="No saved assessments" body="Completed reports are saved locally for comparison, history, and shareable report generation." />}
      </GlassPanel>
    </div>
  );
}

function VendorScorecard({ record, setActiveId }: { record: AssessmentRecord; setActiveId: (id: string) => void }) {
  const brief = record.brief;
  return (
    <button onClick={() => setActiveId(record.id)} type="button" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{brief.vendor_name}</p>
          <p className="mt-1 text-sm text-slate-500">{recommendation(brief)}</p>
        </div>
        <RiskPill level={brief.overall_risk_level} score={brief.overall_risk_score} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TinyStat label="Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
        <TinyStat label="Missing evidence" value={String(brief.confidence_breakdown.no_evidence_controls)} />
        <TinyStat label="Breaches" value={String(brief.breach_history.length)} />
        <TinyStat label="Controls" value={String(brief.categories.length)} />
      </div>
    </button>
  );
}

function CommandPalette({ loadDemoMode, open, setOpen, shareReport }: { loadDemoMode: () => void; open: boolean; setOpen: (open: boolean) => void; shareReport: () => void }) {
  if (!open) return null;
  const actions = [
    ["Load guided demo", loadDemoMode, Sparkles],
    ["Share current report", shareReport, LinkIcon],
    ["Jump to upload", () => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" }), UploadCloud],
  ] as const;
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-24 max-w-xl rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
          <Command className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-500">Command palette · press Esc to close</span>
        </div>
        <div className="mt-3 grid gap-2">
          {actions.map(([label, action, Icon]) => <button key={label} type="button" onClick={() => { action(); setOpen(false); }} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"><Icon className="h-4 w-4 text-blue-600" /> {label}</button>)}
        </div>
      </div>
    </div>
  );
}

function GlassPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-[2.5rem] border border-white/70 bg-white/75 p-5 shadow-xl shadow-slate-200/60 backdrop-blur-xl md:p-6">{children}</div>;
}

function PanelHeader({ body, icon: Icon, title }: { body: string; icon: LucideIcon; title: string }) {
  return <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span><div><h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{body}</p></div></div>;
}

function Expandable({ children, defaultOpen = false, icon: Icon, title }: { children: ReactNode; defaultOpen?: boolean; icon: LucideIcon; title: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className="rounded-[1.5rem] border border-slate-200 bg-white"><button className="flex w-full items-center justify-between px-4 py-4 text-left font-semibold text-slate-950" onClick={() => setOpen((value) => !value)} type="button"><span className="flex items-center gap-3"><Icon className="h-4 w-4 text-blue-600" /> {title}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} /></button>{open ? <motion.div initial={false} animate={{ opacity: 1, height: "auto" }} className="border-t border-slate-100 p-4">{children}</motion.div> : null}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <motion.div whileHover={{ y: -3 }} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p></motion.div>;
}

function ReportMini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></div>;
}

function RiskPill({ level, score }: { level: string; score: number }) {
  const color = level === "high" ? "bg-red-100 text-red-700" : level === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${color}`}>{level} · {score}</span>;
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>;
}

function Progress({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-2 flex justify-between text-sm text-slate-600"><span>{label}</span><span>{value}%</span></div><div className="h-2 rounded-full bg-slate-100"><motion.div className="h-full rounded-full bg-blue-600" animate={{ width: `${value}%` }} /></div></div>;
}

function StateMessage({ children, tone }: { children: ReactNode; tone: "error" | "success" }) {
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tone === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-green-700"}`}>{children}</div>;
}

function EmptyState({ action, body, icon: Icon, title }: { action?: ReactNode; body: string; icon: LucideIcon; title: string }) {
  return <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-gradient-to-br from-white to-blue-50 p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

function buildMetrics(records: AssessmentRecord[]) {
  const assessments = records.length;
  const frameworkCoverage = assessments ? Math.round(records.reduce((sum, item) => sum + item.brief.plan.frameworks.length, 0) / (assessments * 3) * 100) : 0;
  return { assessments, frameworkCoverage };
}

function recommendation(brief: RiskBrief) {
  if (brief.overall_risk_score > 65) return "Escalate before approval";
  if (brief.flagged_gaps.length) return "Approve after targeted follow-up";
  return "Proceed with standard vendor controls";
}

function allCitations(brief: RiskBrief) {
  const citations = [...brief.categories.flatMap((item) => item.citations), ...brief.flagged_gaps.flatMap((gap) => gap.citations || [])];
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.source}:${citation.location}:${citation.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function smartFollowUpGroups(brief: RiskBrief) {
  const gap = brief.flagged_gaps[0]?.category?.replaceAll("_", " ") || "open evidence";
  return [
    { role: "Vendor", questions: [brief.follow_up_questions[0] || `Provide current evidence for ${gap}.`, "Provide penetration testing or third-party assessment reports."] },
    { role: "Security", questions: [`Can we accept ${brief.vendor_name}'s current risk for the intended use case?`, "Which gaps require compensating controls?"] },
    { role: "Legal", questions: ["Do breach notification terms match internal requirements?", "Are subprocessors and audit rights documented?"] },
    { role: "Procurement", questions: [`Should procurement proceed with ${recommendation(brief).toLowerCase()}?`, "What response is required before purchase approval?"] },
    { role: "Engineering", questions: ["Does rollout require SSO, SCIM, or network restrictions?", "How often are backups and disaster recovery procedures tested?"] },
  ];
}

function highlightSearch(text: string, query: string) {
  if (!query.trim()) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return <>{text.slice(0, index)}<mark className="rounded bg-yellow-200 px-1">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

function createDemoRecord(): AssessmentRecord {
  return {
    id: safeId("demo"),
    createdAt: new Date().toISOString(),
    brief: {
      vendor_name: "Demo Vendor",
      overall_risk_score: 48,
      overall_risk_level: "medium",
      confidence_score: 0.76,
      confidence_breakdown: {
        score: 0.76,
        direct_evidence_controls: 3,
        partial_evidence_controls: 1,
        no_evidence_controls: 1,
        total_controls: 5,
        formula: "76% = 3/5 control categories verified with direct evidence, 1 with partial evidence, 1 with no evidence.",
        notes: ["Access control and monitoring have direct evidence.", "Disaster recovery needs additional evidence."],
      },
      auditor_opinion: "Sample auditor opinion indicates controls were suitably designed with follow-up required for availability evidence.",
      workflow_trace: ["Demo documents loaded", "Evidence matched", "Risk calculated"],
      plan: { frameworks: ["SOC2", "ISO27001", "GDPR"], categories: ["access_control", "security_monitoring", "availability"], rationale: "Demo mode loads representative evidence for product walkthroughs." },
      categories: [
        { category: "access_control", status: "review", score: 44, confidence: 0.82, rationale: "MFA and administrative access evidence were found, but rollout proof should be confirmed.", gaps: ["Provide current MFA enforcement evidence."], citations: [{ source: "demo-soc2.pdf", location: "page 12", quote: "Logical access controls require MFA for privileged administrative accounts." }] },
        { category: "security_monitoring", status: "pass", score: 30, confidence: 0.84, rationale: "Monitoring and alerting evidence is supported by the SOC2 excerpt.", gaps: [], citations: [{ source: "demo-soc2.pdf", location: "page 18", quote: "Security events are logged centrally and reviewed by the security operations team." }] },
        { category: "availability", status: "gap", score: 68, confidence: 0.55, rationale: "Backup policy is described, but disaster recovery test evidence is incomplete.", gaps: ["Disaster recovery testing evidence is incomplete."], citations: [{ source: "demo-questionnaire.csv", location: "row 7", quote: "Backups are performed daily; disaster recovery testing documentation is pending." }] },
      ],
      flagged_gaps: [{ category: "availability", gap: "Disaster recovery testing evidence is incomplete.", score: 68, citations: [{ source: "demo-questionnaire.csv", location: "row 7", quote: "Backups are performed daily; disaster recovery testing documentation is pending." }] }],
      follow_up_questions: ["Provide disaster recovery test results and recovery-time objectives.", "Provide MFA enforcement evidence for privileged users."],
      breach_history: [],
    },
  };
}

function toMarkdown(brief: RiskBrief) {
  return `# Vendor Risk Report: ${brief.vendor_name}

## Executive Summary
${brief.vendor_name} is ${brief.overall_risk_level} risk with ${Math.round(brief.confidence_score * 100)}% confidence.

## Recommendation
${recommendation(brief)}

## Evidence and Findings
${brief.categories.map((item) => `### ${item.category}
- Score: ${item.score}/100
- Status: ${item.status}
- Rationale: ${item.rationale}
- Gaps: ${item.gaps.join("; ") || "No gaps detected"}
`).join("\n")}
`;
}
