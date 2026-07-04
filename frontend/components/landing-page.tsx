"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileCheck2,
  FileJson,
  FileText,
  Filter,
  GitBranch,
  History,
  Layers3,
  LineChart,
  Link as LinkIcon,
  LucideIcon,
  MonitorCheck,
  Network,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Table2,
  UploadCloud,
} from "lucide-react";

import { Citation, RiskBrief, TraceEvent, streamAssessmentTrace } from "../lib/api";

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

type FrameworkControl = {
  framework: string;
  id: string;
  category: string;
  title: string;
  description: string;
};

const repoUrl = "https://github.com/imranrkhan13/vendor";
const storageKey = "vendor-risk-assessment-history";

const defaultFrameworks: FrameworkControl[] = [
  {
    framework: "SOC2",
    id: "CC6",
    category: "access_control",
    title: "Logical and Physical Access Controls",
    description: "Controls restrict logical and physical access to systems, data, and facilities.",
  },
  {
    framework: "SOC2",
    id: "CC7",
    category: "security_monitoring",
    title: "System Operations and Monitoring",
    description: "Controls monitor system components, detect anomalies, and respond to security events.",
  },
  {
    framework: "SOC2",
    id: "CC8",
    category: "change_management",
    title: "Change Management",
    description: "Controls authorize, test, approve, and track system changes.",
  },
  {
    framework: "SOC2",
    id: "A1",
    category: "availability",
    title: "Availability",
    description: "Controls support availability commitments through backups, recovery, and resilience.",
  },
  {
    framework: "ISO27001",
    id: "A.9",
    category: "access_control",
    title: "Access Control",
    description: "Access to information and systems is limited according to business requirements.",
  },
  {
    framework: "GDPR",
    id: "Art. 32",
    category: "data_protection",
    title: "Security of Processing",
    description: "Appropriate technical and organizational measures protect personal data.",
  },
];

const storySteps = [
  "Upload a SOC2 report.",
  "Cross-check vendor claims.",
  "Generate a complete risk assessment in minutes.",
];

const productSections = [
  ["Problem", "Vendor reviews are split across PDFs, spreadsheets, inboxes, and breach searches."],
  ["How it works", "The agent plans, retrieves evidence twice, calls tools, scores deterministically, and produces a cited brief."],
  ["Architecture", "Parser, framework registry, planning agent, retriever, scoring engine, FastAPI, and Next.js stay separate."],
  ["Workflow", "A live reasoning trace shows every step from upload to risk brief."],
  ["Supported frameworks", "SOC2, ISO 27001, and GDPR mappings normalize controls into comparable categories."],
  ["Risk preview", "Security teams see risk, confidence, missing controls, follow-ups, and citations together."],
  ["Comparison", "Compare vendors by controls, breaches, confidence, and recommendation."],
  ["Enterprise ready", "History, exports, evidence explorer, and monitoring prepare the demo for real vendor operations."],
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const createDraft = (): VendorDraft => ({
  id: crypto.randomUUID(),
  name: "",
});

export default function LandingPage() {
  const [drafts, setDrafts] = useState<VendorDraft[]>([createDraft()]);
  const [records, setRecords] = useState<AssessmentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [frameworks, setFrameworks] = useState<FrameworkControl[]>(defaultFrameworks);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AssessmentRecord[];
        setRecords(parsed);
        setActiveId(parsed[0]?.id ?? null);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    fetch(`${apiBase}/frameworks`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.controls?.length) {
          setFrameworks(payload.controls);
        }
      })
      .catch(() => {
        setFrameworks(defaultFrameworks);
      });
  }, []);

  const activeRecord = useMemo(
    () => records.find((record) => record.id === activeId) ?? records[0] ?? null,
    [activeId, records],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesQuery = record.brief.vendor_name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || record.brief.overall_risk_level === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, records, statusFilter]);

  const metrics = useMemo(() => buildMetrics(records), [records]);

  async function assessDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setTrace([]);
    setLoading(true);
    setUploadProgress(8);

    const validDrafts = drafts.filter((draft) => draft.name && draft.soc2 && draft.questionnaire);
    if (!validDrafts.length) {
      setError("Add at least one vendor with a SOC2 PDF and questionnaire.");
      setLoading(false);
      setUploadProgress(0);
      return;
    }

    try {
      const nextRecords: AssessmentRecord[] = [];
      for (const [index, draft] of validDrafts.entries()) {
        const formData = new FormData();
        formData.append("vendor_name", draft.name);
        formData.append("soc2_report", draft.soc2 as File);
        formData.append("questionnaire", draft.questionnaire as File);
        if (draft.breach) {
          formData.append("breach_history", draft.breach);
        }
        setPdfUrl(URL.createObjectURL(draft.soc2 as File));
        setUploadProgress(Math.round((index / validDrafts.length) * 70) + 12);

        const brief = await streamAssessmentTrace(formData, (eventItem) => {
          setTrace((current) => [...current, { ...eventItem, message: `${draft.name}: ${eventItem.message}` }]);
        });
        nextRecords.push({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          brief,
        });
      }

      setRecords((current) => [...nextRecords, ...current]);
      setActiveId(nextRecords[0]?.id ?? null);
      const firstCitation = nextRecords[0]?.brief.categories.flatMap((category) => category.citations)[0];
      setSelectedCitation(firstCitation ?? null);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 900);
    }
  }

  function updateDraft(id: string, patch: Partial<VendorDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function exportRecord(format: "json" | "markdown" | "pdf", record: AssessmentRecord | null = activeRecord) {
    if (!record) return;
    if (format === "pdf") {
      window.print();
      return;
    }
    const content =
      format === "json" ? JSON.stringify(record.brief, null, 2) : toMarkdown(record.brief);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${record.brief.vendor_name.toLowerCase().replace(/\s+/g, "-")}-risk-brief.${format === "json" ? "json" : "md"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function copyShareLink() {
    const url = new URL(window.location.href);
    url.hash = activeRecord ? `assessment-${activeRecord.id}` : "dashboard";
    navigator.clipboard?.writeText(url.toString());
  }

  return (
    <main className="relative overflow-hidden text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#F8FAFC]" />
      <div className="soft-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px]" />
      <Nav />
      <Hero />
      <StorySections frameworks={frameworks} />
      <ProductWorkspace
        activeRecord={activeRecord}
        copyShareLink={copyShareLink}
        drafts={drafts}
        error={error}
        exportRecord={exportRecord}
        filteredRecords={filteredRecords}
        frameworks={frameworks}
        loading={loading}
        metrics={metrics}
        pdfUrl={pdfUrl}
        query={query}
        records={records}
        selectedCitation={selectedCitation}
        setActiveId={setActiveId}
        setDrafts={setDrafts}
        setQuery={setQuery}
        setSelectedCitation={setSelectedCitation}
        setStatusFilter={setStatusFilter}
        statusFilter={statusFilter}
        submit={assessDrafts}
        trace={trace}
        updateDraft={updateDraft}
        uploadProgress={uploadProgress}
      />
      <CTA />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <a href="#" className="flex items-center gap-3 text-sm font-semibold text-slate-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <ShieldCheck className="h-5 w-5" />
          </span>
          Vendor Risk Assessment Agent
        </a>
        <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
          {["Platform", "Dashboard", "Assessment", "Frameworks", "History"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="transition hover:text-blue-600">
              {item}
            </a>
          ))}
        </nav>
        <a
          href={repoUrl}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
        >
          <GitBranch className="h-4 w-4" />
          Source
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-20 md:px-8 lg:grid-cols-[1fr_0.95fr] lg:pb-28 lg:pt-28">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7 }}>
        <Pill icon={Sparkles}>Enterprise security reviews, automated</Pill>
        <h1 className="mt-8 max-w-5xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl lg:text-[5.8rem] lg:leading-[0.9]">
          Vendor risk assessments that read the evidence first.
        </h1>
        <div className="mt-8 grid gap-3 text-xl leading-8 text-slate-600 md:text-2xl">
          {storySteps.map((step, index) => (
            <motion.p
              key={step}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 + index * 0.12 }}
            >
              {step}
            </motion.p>
          ))}
        </div>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
          Upload SOC2 reports, security questionnaires, and breach context. The agent plans the
          review, cross-checks claims, exposes its reasoning trace, and generates a cited risk brief.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="#assessment" className="btn-primary">
            Start assessment <ArrowRight className="h-4 w-4" />
          </a>
          <a href="#dashboard" className="btn-secondary">
            View dashboard
          </a>
        </div>
      </motion.div>
      <HeroIllustration />
    </section>
  );
}

function HeroIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.15 }}
      className="relative"
    >
      <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="absolute -right-8 bottom-12 h-52 w-52 rounded-full bg-indigo-200/60 blur-3xl" />
      <div className="relative rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/80">
        <div className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Assessment workspace
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Evidence-led review
              </h3>
            </div>
            <motion.div
              animate={{ rotate: [0, 4, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-600/20"
            >
              <Brain className="h-6 w-6" />
            </motion.div>
          </div>
          <div className="mt-6 grid gap-3">
            {[
              ["SOC2 parsing", "Page citations extracted", "100%"],
              ["Claim cross-check", "Questionnaire mapped", "Running"],
              ["Risk scoring", "Deterministic rules", "Auditable"],
            ].map(([title, detail, value], index) => (
              <motion.div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, delay: index * 0.2 }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{title}</p>
                    <p className="mt-1 text-sm text-slate-500">{detail}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {value}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {["SOC2", "ISO 27001", "GDPR"].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StorySections({ frameworks }: { frameworks: FrameworkControl[] }) {
  return (
    <section id="platform" className="mx-auto max-w-7xl px-5 py-20 md:px-8">
      <SectionHeader
        eyebrow="A complete review system"
        title="Built to answer what matters in the first few minutes."
        body="The product experience makes the review path visible: what evidence was read, which controls were matched, where gaps appeared, and why the score changed."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {productSections.map(([title, body], index) => (
          <AnimatedCard key={title} delay={index * 0.04}>
            <span className="text-sm font-semibold text-blue-600">0{index + 1}</span>
            <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
          </AnimatedCard>
        ))}
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ProblemFlow />
        <ArchitectureFlow />
      </div>
      <FrameworkExplorer frameworks={frameworks} compact />
    </section>
  );
}

function ProductWorkspace(props: {
  activeRecord: AssessmentRecord | null;
  copyShareLink: () => void;
  drafts: VendorDraft[];
  error: string | null;
  exportRecord: (format: "json" | "markdown" | "pdf", record?: AssessmentRecord | null) => void;
  filteredRecords: AssessmentRecord[];
  frameworks: FrameworkControl[];
  loading: boolean;
  metrics: ReturnType<typeof buildMetrics>;
  pdfUrl: string | null;
  query: string;
  records: AssessmentRecord[];
  selectedCitation: Citation | null;
  setActiveId: (id: string) => void;
  setDrafts: (drafts: VendorDraft[] | ((current: VendorDraft[]) => VendorDraft[])) => void;
  setQuery: (query: string) => void;
  setSelectedCitation: (citation: Citation) => void;
  setStatusFilter: (status: string) => void;
  statusFilter: string;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  trace: TraceEvent[];
  updateDraft: (id: string, patch: Partial<VendorDraft>) => void;
  uploadProgress: number;
}) {
  return (
    <section id="dashboard" className="mx-auto max-w-7xl px-5 py-20 md:px-8">
      <SectionHeader
        eyebrow="Enterprise workspace"
        title="A security platform, not a one-off upload form."
        body="Dashboard, assessment workspace, vendor comparison, history, evidence explorer, and exports are all powered by real assessment results from the existing API."
      />
      <Dashboard metrics={props.metrics} records={props.records} />
      <AssessmentWorkspace {...props} />
      <VendorComparison records={props.records} />
      <HistoryTable
        exportRecord={props.exportRecord}
        filteredRecords={props.filteredRecords}
        query={props.query}
        setActiveId={props.setActiveId}
        setQuery={props.setQuery}
        setStatusFilter={props.setStatusFilter}
        statusFilter={props.statusFilter}
      />
      <MonitoringAndExports activeRecord={props.activeRecord} copyShareLink={props.copyShareLink} exportRecord={props.exportRecord} />
      <FrameworkExplorer frameworks={props.frameworks} />
    </section>
  );
}

function Dashboard({ metrics, records }: { metrics: ReturnType<typeof buildMetrics>; records: AssessmentRecord[] }) {
  return (
    <div className="mt-12">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Assessments" value={String(metrics.assessments)} icon={ClipboardCheck} tone="blue" />
        <MetricCard title="Average Risk" value={`${metrics.averageRisk}/100`} icon={ShieldAlert} tone="amber" />
        <MetricCard title="Critical Findings" value={String(metrics.criticalFindings)} icon={ShieldQuestion} tone="red" />
        <MetricCard title="Framework Coverage" value={`${metrics.frameworkCoverage}%`} icon={Layers3} tone="indigo" />
        <MetricCard title="Confidence Score" value={`${metrics.confidence}%`} icon={Sparkles} tone="green" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader icon={LineChart} title="Assessment Trend" subtitle="Historical assessments from this browser session." />
          <AssessmentTrend records={records} />
        </Card>
        <Card>
          <CardHeader icon={BarChart3} title="Risk Distribution" subtitle="Low, medium, and high vendor risk across saved reports." />
          <RiskDistribution records={records} />
        </Card>
      </div>
    </div>
  );
}

function AssessmentWorkspace({
  activeRecord,
  copyShareLink,
  drafts,
  error,
  exportRecord,
  loading,
  pdfUrl,
  records,
  selectedCitation,
  setActiveId,
  setDrafts,
  setSelectedCitation,
  submit,
  trace,
  updateDraft,
  uploadProgress,
}: Parameters<typeof ProductWorkspace>[0]) {
  return (
    <div id="assessment" className="mt-14 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader icon={UploadCloud} title="Assessment intake" subtitle="Drag, validate, and assess one or more vendors." />
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {drafts.map((draft, index) => (
            <VendorUploadRow key={draft.id} draft={draft} index={index} updateDraft={updateDraft} />
          ))}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setDrafts((current) => [...current, createDraft()])}
              className="btn-secondary justify-center"
            >
              <Plus className="h-4 w-4" />
              Add vendor
            </button>
            <button type="submit" disabled={loading} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Assessing vendors" : "Generate assessments"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {uploadProgress > 0 ? <ProgressBar value={uploadProgress} label="Upload and reasoning progress" /> : null}
          {error ? <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        </form>
        <TracePanel trace={trace} loading={loading} />
      </Card>

      <Card>
        <CardHeader icon={Eye} title="Assessment page" subtitle="Split view for risk, timeline, evidence, gaps, recommendations, and citations." />
        {activeRecord ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <AssessmentLeft record={activeRecord} records={records} setActiveId={setActiveId} />
            <AssessmentRight
              copyShareLink={copyShareLink}
              exportRecord={exportRecord}
              pdfUrl={pdfUrl}
              record={activeRecord}
              selectedCitation={selectedCitation}
              setSelectedCitation={setSelectedCitation}
            />
          </div>
        ) : (
          <EmptyState
            icon={FileCheck2}
            title="Run your first assessment"
            body="The assessment workspace will show vendor risk, confidence, timeline, frameworks, evidence, gap analysis, generated questions, and citations."
          />
        )}
      </Card>
    </div>
  );
}

function VendorUploadRow({
  draft,
  index,
  updateDraft,
}: {
  draft: VendorDraft;
  index: number;
  updateDraft: (id: string, patch: Partial<VendorDraft>) => void;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
          Vendor {index + 1}
          <input
            value={draft.name}
            onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
            placeholder="Vendor legal or product name"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <FileDrop label="SOC2 PDF" accept="application/pdf" file={draft.soc2} onFile={(file) => updateDraft(draft.id, { soc2: file })} required />
        <FileDrop label="Questionnaire" accept=".json,.csv" file={draft.questionnaire} onFile={(file) => updateDraft(draft.id, { questionnaire: file })} required />
        <FileDrop label="Breach history" accept=".txt,.md,.csv,.json" file={draft.breach} onFile={(file) => updateDraft(draft.id, { breach: file })} />
      </div>
    </motion.div>
  );
}

function FileDrop({
  accept,
  file,
  label,
  onFile,
  required = false,
}: {
  accept: string;
  file?: File;
  label: string;
  onFile: (file: File) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) onFile(selected);
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) onFile(dropped);
      }}
      className="group rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
    >
      <input ref={inputRef} className="hidden" type="file" accept={accept} onChange={handleChange} />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition group-hover:bg-blue-100 group-hover:text-blue-700">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {label} {required ? <span className="text-blue-600">*</span> : null}
          </p>
          <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">
            {file ? `${file.name} · ${formatBytes(file.size)}` : "Drag file or browse"}
          </p>
        </div>
      </div>
    </button>
  );
}

function AssessmentLeft({
  record,
  records,
  setActiveId,
}: {
  record: AssessmentRecord;
  records: AssessmentRecord[];
  setActiveId: (id: string) => void;
}) {
  const brief = record.brief;
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-5">
        <p className="text-sm font-medium text-blue-700">Vendor</p>
        <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{brief.vendor_name}</h3>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniMetric label="Risk" value={`${brief.overall_risk_score}/100`} />
          <MiniMetric label="Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
        </div>
      </div>
      <Collapsible title="Timeline" icon={History} defaultOpen>
        <RiskTimeline records={records.filter((item) => item.brief.vendor_name === brief.vendor_name)} activeId={record.id} setActiveId={setActiveId} />
      </Collapsible>
      <Collapsible title="Frameworks" icon={Layers3} defaultOpen>
        <div className="flex flex-wrap gap-2">
          {brief.plan.frameworks.map((framework) => (
            <span key={framework} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
              {framework}
            </span>
          ))}
        </div>
      </Collapsible>
      <Collapsible title="Executive summaries" icon={BookOpenCheck}>
        <SummaryGrid brief={brief} />
      </Collapsible>
    </div>
  );
}

function AssessmentRight({
  copyShareLink,
  exportRecord,
  pdfUrl,
  record,
  selectedCitation,
  setSelectedCitation,
}: {
  copyShareLink: () => void;
  exportRecord: (format: "json" | "markdown" | "pdf", record?: AssessmentRecord | null) => void;
  pdfUrl: string | null;
  record: AssessmentRecord;
  selectedCitation: Citation | null;
  setSelectedCitation: (citation: Citation) => void;
}) {
  const brief = record.brief;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => exportRecord("pdf", record)} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
        <button onClick={() => exportRecord("markdown", record)} className="btn-secondary"><FileText className="h-4 w-4" /> Markdown</button>
        <button onClick={() => exportRecord("json", record)} className="btn-secondary"><FileJson className="h-4 w-4" /> JSON</button>
        <button onClick={copyShareLink} className="btn-secondary"><LinkIcon className="h-4 w-4" /> Share link</button>
      </div>
      <Collapsible title="Evidence Viewer" icon={Eye} defaultOpen>
        <EvidenceExplorer brief={brief} selectedCitation={selectedCitation} setSelectedCitation={setSelectedCitation} />
        <CitationPreview citation={selectedCitation} pdfUrl={pdfUrl} />
      </Collapsible>
      <Collapsible title="Gap Analysis" icon={ShieldAlert} defaultOpen>
        <div className="grid gap-3">
          {brief.flagged_gaps.length ? (
            brief.flagged_gaps.map((gap, index) => (
              <div key={`${gap.category}-${index}`} className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                <p className="text-sm font-semibold capitalize text-red-800">{gap.category.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm leading-6 text-red-700">{gap.gap}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No flagged gaps were generated for this assessment.</p>
          )}
        </div>
      </Collapsible>
      <Collapsible title="Recommendations and generated questions" icon={ClipboardCheck} defaultOpen>
        <GeneratedQuestions brief={brief} />
      </Collapsible>
      <Collapsible title="Confidence breakdown" icon={Sparkles} defaultOpen>
        <p className="text-sm leading-6 text-slate-600">{brief.confidence_breakdown.formula}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <MiniMetric label="Direct" value={String(brief.confidence_breakdown.direct_evidence_controls)} />
          <MiniMetric label="Partial" value={String(brief.confidence_breakdown.partial_evidence_controls)} />
          <MiniMetric label="Missing" value={String(brief.confidence_breakdown.no_evidence_controls)} />
        </div>
      </Collapsible>
    </div>
  );
}

function VendorComparison({ records }: { records: AssessmentRecord[] }) {
  const compared = records.slice(0, 5);
  return (
    <div className="mt-14" id="comparison">
      <SectionHeader
        eyebrow="Vendor comparison"
        title="Compare vendors by evidence, not opinion."
        body="Upload multiple vendors in one run and compare SOC2, ISO, GDPR, risk, confidence, controls, breaches, and recommendation."
      />
      <Card className="mt-8 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                {["Vendor", "SOC2", "ISO", "GDPR", "Risk", "Confidence", "Controls", "Breaches", "Recommendation"].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-5 py-4 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compared.length ? compared.map((record) => {
                const brief = record.brief;
                return (
                  <tr key={record.id} className="transition hover:bg-blue-50/40">
                    <td className="border-b border-slate-100 px-5 py-4 font-medium text-slate-900">{brief.vendor_name}</td>
                    <td className="border-b border-slate-100 px-5 py-4">{yesNo(brief.plan.frameworks.includes("SOC2"))}</td>
                    <td className="border-b border-slate-100 px-5 py-4">{yesNo(brief.plan.frameworks.includes("ISO27001"))}</td>
                    <td className="border-b border-slate-100 px-5 py-4">{yesNo(brief.plan.frameworks.includes("GDPR"))}</td>
                    <td className="border-b border-slate-100 px-5 py-4">{brief.overall_risk_score}/100</td>
                    <td className="border-b border-slate-100 px-5 py-4">{Math.round(brief.confidence_score * 100)}%</td>
                    <td className="border-b border-slate-100 px-5 py-4">{brief.categories.length}</td>
                    <td className="border-b border-slate-100 px-5 py-4">{brief.breach_history.length}</td>
                    <td className="border-b border-slate-100 px-5 py-4">{recommendation(brief)}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                    Compare vendors after running one or more assessments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HistoryTable({
  exportRecord,
  filteredRecords,
  query,
  setActiveId,
  setQuery,
  setStatusFilter,
  statusFilter,
}: {
  exportRecord: (format: "json" | "markdown" | "pdf", record?: AssessmentRecord | null) => void;
  filteredRecords: AssessmentRecord[];
  query: string;
  setActiveId: (id: string) => void;
  setQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  statusFilter: string;
}) {
  const [sortKey, setSortKey] = useState<"date" | "risk" | "confidence">("date");
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const sorted = [...filteredRecords].sort((a, b) => {
    if (sortKey === "risk") return b.brief.overall_risk_score - a.brief.overall_risk_score;
    if (sortKey === "confidence") return b.brief.confidence_score - a.brief.confidence_score;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  return (
    <div id="history" className="mt-14">
      <SectionHeader
        eyebrow="Assessment history"
        title="Keep previous reports and compare versions."
        body="History is stored in the browser for the demo, preserving generated briefs, risk movement, exports, and vendor comparison."
      />
      <Card className="mt-8 overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vendors"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All risk levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="date">Sort by date</option>
              <option value="risk">Sort by risk</option>
              <option value="confidence">Sort by confidence</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                {["Vendor", "Date", "Risk", "Confidence", "Findings", "Actions"].map((head) => (
                  <th key={head} className="border-b border-slate-200 px-5 py-4 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length ? visible.map((record) => (
                <tr key={record.id} className="hover:bg-blue-50/40">
                  <td className="border-b border-slate-100 px-5 py-4 font-medium text-slate-900">{record.brief.vendor_name}</td>
                  <td className="border-b border-slate-100 px-5 py-4 text-slate-600">{new Date(record.createdAt).toLocaleString()}</td>
                  <td className="border-b border-slate-100 px-5 py-4"><RiskBadge level={record.brief.overall_risk_level} score={record.brief.overall_risk_score} /></td>
                  <td className="border-b border-slate-100 px-5 py-4">{Math.round(record.brief.confidence_score * 100)}%</td>
                  <td className="border-b border-slate-100 px-5 py-4">{record.brief.flagged_gaps.length}</td>
                  <td className="border-b border-slate-100 px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => setActiveId(record.id)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium hover:border-blue-200 hover:text-blue-700">Open</button>
                      <button onClick={() => exportRecord("json", record)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium hover:border-blue-200 hover:text-blue-700">JSON</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">No assessment history matches the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} className="rounded-full border border-slate-200 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MonitoringAndExports({
  activeRecord,
  copyShareLink,
  exportRecord,
}: {
  activeRecord: AssessmentRecord | null;
  copyShareLink: () => void;
  exportRecord: (format: "json" | "markdown" | "pdf", record?: AssessmentRecord | null) => void;
}) {
  return (
    <div className="mt-14 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader icon={MonitorCheck} title="Continuous monitoring" subtitle="Future-ready vendor monitoring built around saved assessments." />
        <div className="mt-6 grid gap-3">
          {["Monitor vendor risk over time", "Detect improvements and regressions", "Reassess when new SOC2 or breach evidence arrives"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {item}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader icon={FileArchive} title="Export center" subtitle="Export the active assessment for stakeholders." />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button disabled={!activeRecord} onClick={() => exportRecord("pdf")} className="export-button"><Download className="h-4 w-4" /> Beautiful PDF</button>
          <button disabled={!activeRecord} onClick={() => exportRecord("markdown")} className="export-button"><FileText className="h-4 w-4" /> Markdown</button>
          <button disabled={!activeRecord} onClick={() => exportRecord("json")} className="export-button"><FileJson className="h-4 w-4" /> JSON</button>
          <button disabled={!activeRecord} onClick={copyShareLink} className="export-button"><LinkIcon className="h-4 w-4" /> Shareable link</button>
        </div>
      </Card>
    </div>
  );
}

function FrameworkExplorer({ frameworks, compact = false }: { frameworks: FrameworkControl[]; compact?: boolean }) {
  const [active, setActive] = useState("SOC2");
  const frameworkNames = Array.from(new Set(frameworks.map((control) => control.framework)));
  const controls = frameworks.filter((control) => control.framework === active);

  return (
    <div id="frameworks" className={compact ? "mt-10" : "mt-14"}>
      {!compact ? (
        <SectionHeader
          eyebrow="Framework explorer"
          title="Explore controls, coverage, and mappings."
          body="The frontend reads framework mappings from the existing registry endpoint when the backend is available, with a local mirror for static rendering."
        />
      ) : null}
      <Card className="mt-8">
        <div className="flex flex-wrap gap-2">
          {frameworkNames.map((framework) => (
            <button
              key={framework}
              onClick={() => setActive(framework)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${active === framework ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"}`}
            >
              {framework}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {controls.map((control) => (
            <motion.div key={`${control.framework}-${control.id}`} whileHover={{ y: -4 }} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">{control.id}</span>
                <span className="text-xs capitalize text-slate-500">{control.category.replaceAll("_", " ")}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{control.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{control.description}</p>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProblemFlow() {
  const items = ["Download SOC2", "Read evidence", "Compare questionnaire", "Search breach history", "Email follow-ups", "Approve manually"];
  return (
    <Card>
      <CardHeader icon={Clock3} title="Problem" subtitle="Manual review is slow because every source must be reconciled by hand." />
      <div className="mt-6 grid gap-3">
        {items.map((item, index) => (
          <motion.div key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
            <span className="text-sm font-medium text-slate-700">{item}</span>
            <span className="text-xs text-slate-400">0{index + 1}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function ArchitectureFlow() {
  const nodes = ["Upload", "Parser", "Registry", "Planner", "Retrieve", "Tool call", "Score", "Brief"];
  return (
    <Card id="architecture">
      <CardHeader icon={Network} title="Architecture" subtitle="Composable services preserve traceability from document upload to final report." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((node, index) => (
          <motion.div key={node} className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" whileHover={{ y: -3 }}>
            <p className="text-xs font-semibold text-blue-600">0{index + 1}</p>
            <p className="mt-4 font-semibold text-slate-900">{node}</p>
            {index < nodes.length - 1 ? <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-slate-300" /> : null}
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function TracePanel({ trace, loading }: { trace: TraceEvent[]; loading: boolean }) {
  return (
    <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Live reasoning trace</p>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-blue-600" : "bg-slate-300"}`} />
          {loading ? "Streaming" : "Ready"}
        </span>
      </div>
      <div className="mt-4 max-h-56 overflow-auto pr-2">
        {(trace.length ? trace : [{ step: "ready", message: "Upload one or more vendors to stream planning, retrieval, breach lookup, deterministic scoring, and output." }]).map((event, index) => (
          <motion.div key={`${event.step}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3 flex gap-3 last:mb-0">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{event.step.replace("_", " ")}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{event.message}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EvidenceExplorer({
  brief,
  selectedCitation,
  setSelectedCitation,
}: {
  brief: RiskBrief;
  selectedCitation: Citation | null;
  setSelectedCitation: (citation: Citation) => void;
}) {
  return (
    <div className="grid gap-3">
      {brief.categories.map((finding) => (
        <div key={finding.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold capitalize text-slate-900">{finding.category.replaceAll("_", " ")}</p>
            <RiskBadge level={finding.status === "gap" ? "high" : finding.status === "review" ? "medium" : "low"} score={finding.score} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {finding.citations.length ? finding.citations.slice(0, 4).map((citation, index) => {
              const active = selectedCitation?.source === citation.source && selectedCitation.location === citation.location;
              return (
                <button
                  key={`${citation.source}-${citation.location}-${index}`}
                  onClick={() => setSelectedCitation(citation)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"}`}
                >
                  {citation.source} · {citation.location}
                </button>
              );
            }) : <span className="text-sm text-slate-500">No citations for this category.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CitationPreview({ citation, pdfUrl }: { citation: Citation | null; pdfUrl: string | null }) {
  const page = citation?.location.match(/\d+/)?.[0];
  const src = pdfUrl && page ? `${pdfUrl}#page=${page}` : pdfUrl;
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Citation preview</p>
      {citation ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{citation.source} · {citation.location}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{citation.quote}</p>
          </div>
          <div className="min-h-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {src ? <iframe title="Evidence PDF preview" src={src} className="h-64 w-full" /> : <div className="flex h-52 items-center justify-center p-6 text-center text-sm text-slate-500">Upload a SOC2 PDF in this session to jump to cited pages.</div>}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Select a citation to view the exact evidence excerpt and PDF page.</p>
      )}
    </div>
  );
}

function GeneratedQuestions({ brief }: { brief: RiskBrief }) {
  const questions = [
    ...brief.follow_up_questions,
    ...brief.flagged_gaps.slice(0, 3).map((gap) => `What remediation evidence can you provide for ${gap.category.replaceAll("_", " ")}?`),
  ];
  return (
    <div className="grid gap-3">
      {questions.map((question) => (
        <div key={question} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          {question}
        </div>
      ))}
    </div>
  );
}

function SummaryGrid({ brief }: { brief: RiskBrief }) {
  const summaries = [
    ["Technical Summary", `${brief.categories.length} control categories assessed. ${brief.flagged_gaps.length} gaps require validation.`],
    ["Executive Summary", `${brief.vendor_name} is currently ${brief.overall_risk_level} risk with ${Math.round(brief.confidence_score * 100)}% confidence.`],
    ["Legal Summary", brief.plan.frameworks.includes("GDPR") ? "GDPR obligations were included in the review plan." : "No GDPR-specific evidence was selected by the current plan."],
    ["Procurement Summary", recommendation(brief)],
  ];
  return (
    <div className="grid gap-3">
      {summaries.map(([title, body]) => (
        <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        </div>
      ))}
    </div>
  );
}

function AssessmentTrend({ records }: { records: AssessmentRecord[] }) {
  const data = records.slice(0, 8).reverse();
  if (!data.length) return <ChartEmpty message="Run assessments to populate trend data." />;
  const points = data.map((record, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 100 - record.brief.overall_risk_score;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mt-6 h-64">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#2563EB" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${points} 100,100`} fill="url(#trendFill)" />
      </svg>
    </div>
  );
}

function RiskDistribution({ records }: { records: AssessmentRecord[] }) {
  const counts = ["low", "medium", "high"].map((level) => ({
    level,
    count: records.filter((record) => record.brief.overall_risk_level === level).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  return (
    <div className="mt-6 grid gap-4">
      {counts.map((item) => (
        <div key={item.level}>
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span className="capitalize">{item.level}</span>
            <span>{item.count}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(item.count / max) * 100}%` }}
              viewport={{ once: true }}
              className={`h-full rounded-full ${item.level === "low" ? "bg-green-500" : item.level === "medium" ? "bg-amber-500" : "bg-red-600"}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskTimeline({
  activeId,
  records,
  setActiveId,
}: {
  activeId: string;
  records: AssessmentRecord[];
  setActiveId: (id: string) => void;
}) {
  if (!records.length) return <p className="text-sm text-slate-500">No historical assessments for this vendor yet.</p>;
  return (
    <div className="grid gap-3">
      {records.map((record, index) => {
        const previous = records[index + 1];
        const delta = previous ? record.brief.overall_risk_score - previous.brief.overall_risk_score : 0;
        return (
          <button
            key={record.id}
            onClick={() => setActiveId(record.id)}
            className={`rounded-2xl border p-4 text-left transition ${record.id === activeId ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-200"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{new Date(record.createdAt).toLocaleString()}</span>
              <span className={`text-xs font-semibold ${delta > 0 ? "text-red-600" : delta < 0 ? "text-green-600" : "text-slate-500"}`}>
                {delta > 0 ? `Regression +${delta}` : delta < 0 ? `Improvement ${delta}` : "Baseline"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Collapsible({ children, defaultOpen = false, icon: Icon, title }: { children: ReactNode; defaultOpen?: boolean; icon: LucideIcon; title: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
        <span className="flex items-center gap-3 font-semibold text-slate-900"><Icon className="h-4 w-4 text-blue-600" /> {title}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t border-slate-100 px-4 py-4">{children}</motion.div> : null}
    </div>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 md:px-8">
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 p-10 text-white shadow-2xl shadow-blue-600/20 md:p-14">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">Ready for enterprise review queues</p>
        <h2 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">
          Know the vendor risk before the contract is signed.
        </h2>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#assessment" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm">Start assessment <ArrowRight className="h-4 w-4" /></a>
          <a href={repoUrl} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white">View source <ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="font-semibold text-slate-900">Vendor Risk Assessment Agent</p>
        <p>Built for SOC2, ISO 27001, GDPR, deterministic scoring, and evidence-backed decisions.</p>
      </div>
    </footer>
  );
}

function SectionHeader({ body, eyebrow, title }: { body: string; eyebrow: string; title: string }) {
  return (
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="max-w-4xl">
      <Pill>{eyebrow}</Pill>
      <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-slate-950 md:text-6xl">{title}</h2>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{body}</p>
    </motion.div>
  );
}

function Pill({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
      {children}
    </span>
  );
}

function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70 ${className}`}>{children}</div>;
}

function AnimatedCard({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay }} whileHover={{ y: -4 }} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      {children}
    </motion.div>
  );
}

function CardHeader({ icon: Icon, subtitle, title }: { icon: LucideIcon; subtitle: string; title: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, title, tone, value }: { icon: LucideIcon; title: string; tone: "blue" | "amber" | "red" | "indigo" | "green"; value: string }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-green-50 text-green-700",
  };
  return (
    <motion.div whileHover={{ y: -4 }} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-6 text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
    </motion.div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm text-slate-600"><span>{label}</span><span>{value}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-blue-600" initial={{ width: 0 }} animate={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ body, icon: Icon, title }: { body: string; icon: LucideIcon; title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm"><Icon className="h-6 w-6" /></span>
      <h3 className="mt-4 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return <div className="mt-6 flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">{message}</div>;
}

function RiskBadge({ level, score }: { level: string; score: number }) {
  const classes = level === "high" ? "bg-red-50 text-red-700 border-red-100" : level === "medium" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-green-50 text-green-700 border-green-100";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${classes}`}>{level} · {score}</span>;
}

function yesNo(value: boolean) {
  return value ? <span className="text-green-700">Yes</span> : <span className="text-slate-400">No</span>;
}

function buildMetrics(records: AssessmentRecord[]) {
  const assessments = records.length;
  const averageRisk = assessments ? Math.round(records.reduce((sum, record) => sum + record.brief.overall_risk_score, 0) / assessments) : 0;
  const criticalFindings = records.reduce((sum, record) => sum + record.brief.flagged_gaps.length, 0);
  const frameworkCoverage = assessments
    ? Math.round(records.reduce((sum, record) => sum + record.brief.plan.frameworks.length, 0) / (assessments * 3) * 100)
    : 0;
  const confidence = assessments ? Math.round(records.reduce((sum, record) => sum + record.brief.confidence_score, 0) / assessments * 100) : 0;
  return { assessments, averageRisk, confidence, criticalFindings, frameworkCoverage };
}

function recommendation(brief: RiskBrief) {
  if (brief.overall_risk_score > 65) return "Escalate before approval";
  if (brief.flagged_gaps.length) return "Approve after targeted follow-up";
  return "Proceed with standard vendor controls";
}

function toMarkdown(brief: RiskBrief) {
  return `# Vendor Risk Brief: ${brief.vendor_name}

## Executive Summary
${brief.vendor_name} is ${brief.overall_risk_level} risk with an overall score of ${brief.overall_risk_score}/100 and ${Math.round(brief.confidence_score * 100)}% confidence.

## Confidence Breakdown
${brief.confidence_breakdown.formula}

## Frameworks
${brief.plan.frameworks.map((framework) => `- ${framework}`).join("\n")}

## Findings
${brief.categories.map((finding) => `### ${finding.category}
- Status: ${finding.status}
- Score: ${finding.score}/100
- Rationale: ${finding.rationale}
- Gaps: ${finding.gaps.join("; ") || "No gaps detected"}
`).join("\n")}

## Follow-up Questions
${brief.follow_up_questions.map((question) => `- ${question}`).join("\n")}
`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
