"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileJson,
  FileText,
  History,
  Home,
  Layers3,
  Link as LinkIcon,
  LucideIcon,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { Citation, DocumentChatResponse, RiskBrief, TraceEvent, chatWithDocuments, streamAssessmentTrace } from "../lib/api";

type View = "dashboard" | "assess" | "reports" | "chat" | "frameworks" | "history" | "settings";

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

const storageKey = "vendor-risk-assessment-history";
const sharedReportPrefix = "vendor-risk-shared-report:";

function safeId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDraft(): VendorDraft {
  return { id: safeId("vendor"), name: "" };
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-950">
      <section className="relative flex min-h-screen items-center px-6 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.16),transparent_26rem),radial-gradient(circle_at_80%_30%,rgba(79,70,229,0.12),transparent_24rem)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">
              Vendor Risk Assessment Agent
            </p>
            <h1 className="mt-7 max-w-5xl text-6xl font-semibold leading-[0.92] tracking-[-0.075em] md:text-8xl">
              Approve vendors with confidence.
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-8 text-slate-600">
              Upload vendor security documents, watch the agent verify evidence, and get a cited
              risk report your security, procurement, and legal teams can trust.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a className="btn-primary" href="/app">
                Start Assessment <ArrowRight className="h-4 w-4" />
              </a>
              <a className="btn-secondary" href="/app?demo=1">
                Watch Demo
              </a>
              <a className="btn-secondary" href="https://github.com/imranrkhan13/vendor">
                GitHub
              </a>
            </div>
          </div>
          <LandingPreview />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-5 md:grid-cols-3">
          <StoryCard title="Vendor sends documents" body="SOC2 reports, questionnaires, and breach context arrive in different formats." />
          <StoryCard title="The agent verifies evidence" body="It extracts controls, cross-checks claims, and flags contradictions with citations." />
          <StoryCard title="Teams get a decision" body="Security sees findings, procurement sees next steps, and leadership sees business risk." />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-28">
        <div className="rounded-[2.5rem] bg-slate-950 p-10 text-white md:p-14">
          <h2 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">
            Know the risk before you sign.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            The product is simple: run an assessment, review the report, ask questions, share the
            decision.
          </p>
          <a className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950" href="/app">
            Open the app
          </a>
        </div>
      </section>
    </main>
  );
}

function LandingPreview() {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity }}
      className="rounded-[2.25rem] border border-slate-200 bg-white/80 p-5 shadow-2xl shadow-blue-100/70 backdrop-blur"
    >
      <div className="rounded-[1.75rem] bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white">
        <p className="text-sm uppercase tracking-[0.18em] text-blue-100">Decision summary</p>
        <h3 className="mt-8 text-4xl font-semibold tracking-[-0.06em]">Approve after follow-up</h3>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <PreviewMetric label="Risk" value="Medium" />
          <PreviewMetric label="Confidence" value="High" />
          <PreviewMetric label="Evidence" value="Cited" />
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {["SOC2 evidence matched", "Questionnaire contradiction found", "Follow-up question generated"].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {item}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-blue-100">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function StoryCard({ body, title }: { body: string; title: string }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h3>
      <p className="mt-4 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

export function ProductExperience({
  subtitle = "Run assessments, review reports, ask questions, and manage vendor decisions.",
  title = "Vendor Risk Command Center",
  view = "dashboard",
}: {
  subtitle?: string;
  title?: string;
  view?: View;
}) {
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

  const activeRecord = useMemo(() => records.find((record) => record.id === activeId) ?? records[0] ?? null, [activeId, records]);

  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setTrace([]);
    setLoading(true);
    setProgress(10);

    const valid = drafts.filter((draft) => draft.name && draft.soc2 && draft.questionnaire);
    if (!valid.length) {
      setError("Add a vendor name, SOC2 PDF, and questionnaire to start.");
      setLoading(false);
      setProgress(0);
      return;
    }

    try {
      const next: AssessmentRecord[] = [];
      for (const [index, draft] of valid.entries()) {
        const formData = new FormData();
        formData.append("vendor_name", draft.name);
        formData.append("soc2_report", draft.soc2 as File);
        formData.append("questionnaire", draft.questionnaire as File);
        if (draft.breach) formData.append("breach_history", draft.breach);
        setPdfUrl(URL.createObjectURL(draft.soc2 as File));
        setProgress(20 + index * 20);
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
      setTimeout(() => setProgress(0), 900);
    }
  }

  function loadDemoMode() {
    const demo = createDemoRecord();
    setRecords((current) => [demo, ...current]);
    setActiveId(demo.id);
    setSelectedCitation(demo.brief.categories[0]?.citations[0] ?? null);
    setTrace([
      { step: "demo", message: "Loaded sample assessment." },
      { step: "reason", message: "Calculated deterministic risk and confidence." },
      { step: "complete", message: "Report ready." },
    ]);
  }

  function updateDraft(id: string, patch: Partial<VendorDraft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function shareReport() {
    if (!activeRecord) return;
    const token = safeId("share");
    window.localStorage.setItem(`${sharedReportPrefix}${token}`, JSON.stringify(activeRecord));
    const url = new URL(window.location.href);
    url.pathname = `/report/${token}`;
    navigator.clipboard?.writeText(url.toString()).catch(() => undefined);
    setShareStatus("Share link copied.");
    setTimeout(() => setShareStatus(null), 3000);
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

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <AppShell title={title} subtitle={subtitle}>
        {view === "dashboard" ? <DashboardView records={records} activeRecord={activeRecord} loadDemoMode={loadDemoMode} /> : null}
        {view === "assess" ? (
          <AssessView
            drafts={drafts}
            error={error}
            loading={loading}
            loadDemoMode={loadDemoMode}
            progress={progress}
            setDrafts={setDrafts}
            submitAssessment={submitAssessment}
            trace={trace}
            updateDraft={updateDraft}
            activeRecord={activeRecord}
          />
        ) : null}
        {view === "reports" ? (
          <ReportsView
            activeRecord={activeRecord}
            records={records}
            setActiveId={setActiveId}
            shareReport={shareReport}
            shareStatus={shareStatus}
            exportRecord={exportRecord}
            selectedCitation={selectedCitation}
            setSelectedCitation={setSelectedCitation}
            pdfUrl={pdfUrl}
          />
        ) : null}
        {view === "chat" ? <ChatView activeRecord={activeRecord} selectedCitation={selectedCitation} setSelectedCitation={setSelectedCitation} /> : null}
        {view === "frameworks" ? <FrameworksView activeRecord={activeRecord} /> : null}
        {view === "history" ? <HistoryView records={records} setActiveId={setActiveId} /> : null}
        {view === "settings" ? <SettingsView /> : null}
      </AppShell>
    </main>
  );
}

function AppShell({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  const nav = [
    ["/app", "Dashboard", Home],
    ["/assess", "Run Assessment", UploadCloud],
    ["/reports", "Reports", BookOpenCheck],
    ["/chat", "AI Chat", MessageSquare],
    ["/frameworks", "Frameworks", Layers3],
    ["/history", "History", History],
    ["/settings", "Settings", Settings],
  ] as const;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 p-4 backdrop-blur-xl lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Vendor Risk</p>
            <p className="text-xs text-slate-500">Security review platform</p>
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
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 md:flex">
              <Search className="h-4 w-4" />
              Search reports
            </div>
          </div>
        </header>
        <div className="px-5 py-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

function DashboardView({ activeRecord, loadDemoMode, records }: { activeRecord: AssessmentRecord | null; loadDemoMode: () => void; records: AssessmentRecord[] }) {
  return (
    <div className="grid gap-6">
      <SectionIntro
        title="What should we review next?"
        body="Start a new vendor assessment, open the latest report, or use demo mode to explore the product."
        action={<a className="btn-primary" href="/assess">Run assessment</a>}
        secondary={<button className="btn-secondary" onClick={loadDemoMode} type="button">Load demo</button>}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Reports" value={String(records.length)} />
        <Metric label="Latest risk" value={activeRecord ? activeRecord.brief.overall_risk_level : "None"} />
        <Metric label="Confidence" value={activeRecord ? `${Math.round(activeRecord.brief.confidence_score * 100)}%` : "No data"} />
        <Metric label="Findings" value={activeRecord ? String(activeRecord.brief.flagged_gaps.length) : "0"} />
      </div>
      <ReportsList records={records} emptyText="No reports yet. Run your first assessment to see decisions here." />
    </div>
  );
}

function AssessView(props: {
  activeRecord: AssessmentRecord | null;
  drafts: VendorDraft[];
  error: string | null;
  loading: boolean;
  loadDemoMode: () => void;
  progress: number;
  setDrafts: (updater: VendorDraft[] | ((current: VendorDraft[]) => VendorDraft[])) => void;
  submitAssessment: (event: FormEvent<HTMLFormElement>) => void;
  trace: TraceEvent[];
  updateDraft: (id: string, patch: Partial<VendorDraft>) => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel>
        <PanelHeader icon={UploadCloud} title="Upload vendor package" body="SOC2 report and questionnaire are required. Breach history is optional." />
        <form className="mt-6 grid gap-4" onSubmit={props.submitAssessment}>
          {props.drafts.map((draft, index) => (
            <VendorUploadRow key={draft.id} draft={draft} index={index} updateDraft={props.updateDraft} />
          ))}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="btn-secondary justify-center" onClick={() => props.setDrafts((current) => [...current, createDraft()])} type="button">
              <Plus className="h-4 w-4" />
              Add vendor
            </button>
            <button className="btn-secondary justify-center" onClick={props.loadDemoMode} type="button">
              <Sparkles className="h-4 w-4" />
              Demo mode
            </button>
            <button className="btn-primary justify-center" disabled={props.loading} type="submit">
              {props.loading ? "Analyzing..." : "Generate report"}
            </button>
          </div>
          {props.progress ? <Progress label="Assessment progress" value={props.progress} /> : null}
          {props.error ? <StateMessage tone="error">{props.error}</StateMessage> : null}
        </form>
      </Panel>
      <Panel>
        <PanelHeader icon={ClipboardCheck} title="Live analysis" body="The agent shows what it is doing as it reviews evidence." />
        <div className="mt-6 grid gap-3">
          {(props.trace.length ? props.trace.map((item) => item.message) : ["Waiting for documents", "Evidence extraction", "Questionnaire cross-check", "Risk scoring"]).map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <CheckCircle2 className={`h-4 w-4 ${props.trace.length ? "text-green-600" : "text-slate-300"}`} />
              {item}
            </div>
          ))}
        </div>
        {props.activeRecord ? <ReportSummary record={props.activeRecord} /> : null}
      </Panel>
    </div>
  );
}

function ReportsView(props: {
  activeRecord: AssessmentRecord | null;
  exportRecord: (format: "pdf" | "markdown" | "json") => void;
  pdfUrl: string | null;
  records: AssessmentRecord[];
  selectedCitation: Citation | null;
  setActiveId: (id: string) => void;
  setSelectedCitation: (citation: Citation) => void;
  shareReport: () => void;
  shareStatus: string | null;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <Panel>
        <PanelHeader icon={BookOpenCheck} title="Reports" body="Open a report, share it, or export it for stakeholders." />
        <ReportsList records={props.records} setActiveId={props.setActiveId} emptyText="No reports yet. Run an assessment first." />
      </Panel>
      <Panel>
        {props.activeRecord ? (
          <>
            <ReportSummary record={props.activeRecord} />
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={props.shareReport} type="button"><LinkIcon className="h-4 w-4" /> Share</button>
              <button className="btn-secondary" onClick={() => props.exportRecord("pdf")} type="button"><Download className="h-4 w-4" /> PDF</button>
              <button className="btn-secondary" onClick={() => props.exportRecord("markdown")} type="button"><FileText className="h-4 w-4" /> Markdown</button>
              <button className="btn-secondary" onClick={() => props.exportRecord("json")} type="button"><FileJson className="h-4 w-4" /> JSON</button>
            </div>
            {props.shareStatus ? <StateMessage tone="success">{props.shareStatus}</StateMessage> : null}
            <EvidenceExplorer brief={props.activeRecord.brief} selectedCitation={props.selectedCitation} setSelectedCitation={props.setSelectedCitation} />
            <CitationPreview citation={props.selectedCitation} pdfUrl={props.pdfUrl} />
          </>
        ) : (
          <EmptyState title="No report selected" body="Choose a saved report or run an assessment." icon={BookOpenCheck} />
        )}
      </Panel>
    </div>
  );
}

function ChatView({ activeRecord, selectedCitation, setSelectedCitation }: { activeRecord: AssessmentRecord | null; selectedCitation: Citation | null; setSelectedCitation: (citation: Citation) => void }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Panel>
        <PanelHeader icon={MessageSquare} title="Past chats" body="Chats are based on the selected assessment report." />
        {activeRecord ? <ReportSummary record={activeRecord} compact /> : <EmptyState icon={MessageSquare} title="No assessment loaded" body="Run an assessment or load demo mode from the dashboard." />}
      </Panel>
      <Panel>
        {activeRecord ? (
          <DocumentChat brief={activeRecord.brief} selectedCitation={selectedCitation} setSelectedCitation={setSelectedCitation} />
        ) : (
          <EmptyState icon={MessageSquare} title="Ask documents after assessment" body="Once a report exists, ask questions like 'Where is MFA mentioned?' and get cited answers." />
        )}
      </Panel>
    </div>
  );
}

function FrameworksView({ activeRecord }: { activeRecord: AssessmentRecord | null }) {
  const frameworks = ["SOC2", "ISO27001", "GDPR", "NIST", "HIPAA", "PCI DSS"];
  return (
    <Panel>
      <PanelHeader icon={Layers3} title="Compliance explorer" body="See which frameworks are selected and how evidence maps to them." />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {frameworks.map((framework) => {
          const active = activeRecord?.brief.plan.frameworks.includes(framework);
          return (
            <div key={framework} className={`rounded-2xl border p-5 ${active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
              <p className="font-semibold text-slate-950">{framework}</p>
              <p className="mt-3 text-sm text-slate-600">{active ? "Mapped in latest assessment." : "Available for future mapping."}</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function HistoryView({ records, setActiveId }: { records: AssessmentRecord[]; setActiveId: (id: string) => void }) {
  return (
    <Panel>
      <PanelHeader icon={History} title="Assessment history" body="Review previous decisions and reopen reports." />
      <ReportsList records={records} setActiveId={setActiveId} emptyText="No assessment history yet." />
    </Panel>
  );
}

function SettingsView() {
  return (
    <Panel>
      <PanelHeader icon={Settings} title="Settings" body="Deployment and API defaults." />
      <div className="mt-6 grid gap-4">
        <SettingRow label="Frontend API behavior" value="Uses NEXT_PUBLIC_API_BASE_URL when set, otherwise calls the current host on port 8000." />
        <SettingRow label="Reports" value="Stored locally for the demo and exportable as PDF, Markdown, or JSON." />
        <SettingRow label="AI chat" value="Uses the backend /chat endpoint and returns citations from assessment evidence." />
      </div>
    </Panel>
  );
}

function SectionIntro({ action, body, secondary, title }: { action?: ReactNode; body: string; secondary?: ReactNode; title: string }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
      {(action || secondary) ? <div className="mt-5 flex flex-wrap gap-3">{action}{secondary}</div> : null}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">{children}</section>;
}

function PanelHeader({ body, icon: Icon, title }: { body: string; icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function VendorUploadRow({ draft, index, updateDraft }: { draft: VendorDraft; index: number; updateDraft: (id: string, patch: Partial<VendorDraft>) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Vendor {index + 1}
        <input className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" value={draft.name} onChange={(event) => updateDraft(draft.id, { name: event.target.value })} placeholder="Vendor name" />
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
    <button className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50" type="button" onClick={() => ref.current?.click()}>
      <input ref={ref} className="hidden" type="file" accept={accept} onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        if (selected) onFile(selected);
      }} />
      <UploadCloud className="h-5 w-5 text-blue-600" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{file ? file.name : "Choose file"}</p>
    </button>
  );
}

function ReportsList({ emptyText, records, setActiveId }: { emptyText: string; records: AssessmentRecord[]; setActiveId?: (id: string) => void }) {
  if (!records.length) return <EmptyState icon={BookOpenCheck} title="Nothing here yet" body={emptyText} />;
  return (
    <div className="mt-5 grid gap-3">
      {records.map((record) => (
        <button key={record.id} onClick={() => setActiveId?.(record.id)} type="button" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-200 hover:bg-blue-50">
          <p className="font-semibold">{record.brief.vendor_name}</p>
          <p className="mt-1 text-sm text-slate-600">{record.brief.overall_risk_level} risk · {Math.round(record.brief.confidence_score * 100)}% confidence</p>
        </button>
      ))}
    </div>
  );
}

function ReportSummary({ compact = false, record }: { compact?: boolean; record: AssessmentRecord }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white ${compact ? "mt-5" : "mt-6"}`}>
      <p className="text-sm uppercase tracking-[0.14em] text-blue-100">Decision summary</p>
      <h3 className="mt-3 text-2xl font-semibold">{record.brief.vendor_name}</h3>
      <p className="mt-2 text-sm text-blue-50">{recommendation(record.brief)}</p>
      {!compact ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PreviewMetric label="Risk" value={`${record.brief.overall_risk_score}/100`} />
          <PreviewMetric label="Confidence" value={`${Math.round(record.brief.confidence_score * 100)}%`} />
          <PreviewMetric label="Findings" value={String(record.brief.flagged_gaps.length)} />
        </div>
      ) : null}
    </div>
  );
}

function EvidenceExplorer({ brief, selectedCitation, setSelectedCitation }: { brief: RiskBrief; selectedCitation: Citation | null; setSelectedCitation: (citation: Citation) => void }) {
  return (
    <div className="mt-5 grid gap-3">
      {brief.categories.map((finding) => (
        <div key={finding.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold capitalize">{finding.category.replaceAll("_", " ")}</p>
          <p className="mt-2 text-sm text-slate-600">{finding.rationale}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {finding.citations.map((citation, index) => (
              <button key={`${citation.source}-${index}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedCitation?.quote === citation.quote ? "bg-blue-600 text-white" : "bg-white text-blue-700"}`} onClick={() => setSelectedCitation(citation)} type="button">
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
  const page = citation?.location.match(/\d+/)?.[0];
  const src = pdfUrl && page ? `${pdfUrl}#page=${page}` : pdfUrl;
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {citation ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">{citation.source} · {citation.location}</p>
            <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-slate-700">{citation.quote}</p>
          </div>
          <div className="min-h-52 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {src ? <iframe title="PDF evidence" src={src} className="h-64 w-full" /> : <div className="p-6 text-sm text-slate-500">Upload a PDF to preview cited pages.</div>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Select a citation to inspect source evidence.</p>
      )}
    </div>
  );
}

function DocumentChat({ brief, selectedCitation, setSelectedCitation }: { brief: RiskBrief; selectedCitation: Citation | null; setSelectedCitation: (citation: Citation) => void }) {
  const [question, setQuestion] = useState("Where is MFA mentioned?");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; citations?: Citation[]; provider?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const citations = useMemo(() => allCitations(brief), [brief]);

  async function ask(input = question) {
    if (!input.trim()) return;
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: input }]);
    try {
      const response: DocumentChatResponse = await chatWithDocuments({ question: input, citations, vendor_name: brief.vendor_name });
      setMessages((current) => [...current, { role: "assistant", content: response.answer, citations: response.citations, provider: response.provider }]);
      if (response.citations[0]) setSelectedCitation(response.citations[0]);
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Chat failed." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {["Where is MFA mentioned?", "Summarize for legal.", "Does the questionnaire contradict the audit?"].map((prompt) => (
          <button key={prompt} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700" onClick={() => ask(prompt)} type="button">
            {prompt}
          </button>
        ))}
      </div>
      <div className="min-h-80 rounded-2xl border border-slate-200 bg-white p-4">
        {messages.length ? messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`mb-3 rounded-2xl p-4 text-sm leading-6 ${message.role === "user" ? "ml-8 bg-blue-600 text-white" : "mr-8 bg-slate-50 text-slate-700"}`}>
            {message.content}
            {message.citations?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.citations.map((citation, citationIndex) => (
                  <button key={`${citation.source}-${citationIndex}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700" onClick={() => setSelectedCitation(citation)} type="button">
                    {citation.source} · {citation.location}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )) : (
          <EmptyState icon={MessageSquare} title="Ask the documents" body="Questions will be answered using citations from the selected report." />
        )}
      </div>
      <div className="flex gap-2">
        <input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="btn-primary" disabled={loading} onClick={() => ask()} type="button"><Send className="h-4 w-4" /> Ask</button>
      </div>
      {selectedCitation ? <p className="text-xs text-slate-500">Highlighted citation: {selectedCitation.source} · {selectedCitation.location}</p> : null}
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold">{label}</p>
      <p className="mt-2 text-sm text-slate-600">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm text-slate-600"><span>{label}</span><span>{value}%</span></div>
      <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function StateMessage({ children, tone }: { children: ReactNode; tone: "error" | "success" }) {
  return <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${tone === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-green-700"}`}>{children}</div>;
}

function EmptyState({ body, icon: Icon, title }: { body: string; icon: LucideIcon; title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-blue-600" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
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

function recommendation(brief: RiskBrief) {
  if (brief.overall_risk_score > 65) return "Escalate before approval";
  if (brief.flagged_gaps.length) return "Approve after targeted follow-up";
  return "Proceed with standard vendor controls";
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
`;
}
