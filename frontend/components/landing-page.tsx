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
    <section className="relative mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="absolute left-1/2 top-16 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-200/45 blur-3xl" />
      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.7 }}>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">
          Vendor reviews are still manual
        </p>
        <h1 className="mt-7 max-w-5xl text-6xl font-semibold tracking-[-0.075em] text-slate-950 md:text-8xl lg:text-[7.4rem] lg:leading-[0.86]">
          Stop reading
          <span className="block text-slate-400">150-page</span>
          SOC2 reports.
        </h1>
        <p className="mt-8 max-w-2xl text-2xl leading-9 tracking-[-0.03em] text-slate-600 md:text-3xl">
          Read the evidence, not the paperwork.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4 text-lg font-medium text-slate-500">
          {["Upload.", "Analyze.", "Decide."].map((item, index) => (
            <motion.span
              key={item}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.12 }}
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 shadow-sm"
            >
              {item}
            </motion.span>
          ))}
        </div>
        <a href="#assessment" className="btn-primary mt-10">
          Try assessment <ArrowRight className="h-4 w-4" />
        </a>
      </motion.div>
      <PainfulReviewIllustration />
    </section>
  );
}

function PainfulReviewIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.15 }}
      className="relative"
    >
      <div className="absolute -left-8 top-8 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="absolute -right-8 bottom-10 h-56 w-56 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="relative min-h-[520px]">
        {[
          ["150-page SOC2", "Manual reading", FileText, "left-0 top-10 rotate-[-6deg]"],
          ["Security spreadsheet", "Claims to compare", Table2, "right-2 top-28 rotate-[5deg]"],
          ["Email thread", "Waiting on answers", GitBranch, "left-10 bottom-24 rotate-[4deg]"],
          ["Approval meeting", "Decision delayed", Clock3, "right-14 bottom-8 rotate-[-4deg]"],
        ].map(([title, body, Icon, position], index) => (
          <motion.div
            key={title as string}
            className={`absolute w-64 rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-200/80 backdrop-blur ${position}`}
            animate={{ y: [0, -10, 0], rotate: index % 2 ? [2, 4, 2] : [-3, -5, -3] }}
            transition={{ duration: 5.5, repeat: Infinity, delay: index * 0.22 }}
          >
            <Icon className="h-5 w-5 text-slate-400" />
            <p className="mt-10 text-lg font-semibold tracking-[-0.03em] text-slate-950">{title as string}</p>
            <p className="mt-2 text-sm text-slate-500">{body as string}</p>
          </motion.div>
        ))}
        <motion.div
          className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-200/60"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <div className="rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white">
            <Brain className="h-7 w-7" />
            <p className="mt-16 text-sm uppercase tracking-[0.18em] text-blue-100">One upload</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Risk brief in minutes</h3>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StorySections({ frameworks }: { frameworks: FrameworkControl[] }) {
  return (
    <section id="platform" className="relative">
      <PainToAutomation />
      <ScrollExtractionStory />
      <InteractiveAssessmentStory />
      <ReasoningStory />
      <TrustStory />
      <FrameworkConstellation frameworks={frameworks} />
      <LivingDashboardStory />
      <PipelineStory />
    </section>
  );
}

function PainToAutomation() {
  const painful = [
    ["PDF", "A report gets downloaded."],
    ["Spreadsheet", "Claims are copied by hand."],
    ["Email", "Questions wait in inboxes."],
    ["Slack", "Context gets scattered."],
    ["Meetings", "Approval waits for consensus."],
    ["Approval", "The decision arrives days later."],
  ];
  const automated = ["Upload", "Risk Brief", "Decision"];

  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <div className="grid gap-16 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">The old workflow</p>
          <h2 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
            Every review turns into a relay race.
          </h2>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-600">
            Procurement waits. Security reads. Legal asks for evidence. Someone still has to connect
            the PDF, the questionnaire, and the breach history before a decision can be defended.
          </p>
        </motion.div>
        <div className="grid gap-4">
          {painful.map(([title, body], index) => (
            <motion.div
              key={title}
              className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-950">{title}</p>
                <p className="text-sm text-slate-500">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-20 max-w-4xl rounded-[2rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-xl shadow-blue-100/70">
        <div className="grid gap-4 md:grid-cols-3">
          {automated.map((item, index) => (
            <motion.div
              key={item}
              className="rounded-[1.5rem] bg-white p-5 text-center shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12 }}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">{item}</p>
              <p className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {index === 2 ? "30 seconds" : index === 1 ? "Cited" : "One file set"}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScrollExtractionStory() {
  const stages = [
    ["SOC2 pages separate", "The report is converted into page-grounded evidence chunks."],
    ["Controls are extracted", "SOC2, ISO 27001, and GDPR mappings identify the relevant categories."],
    ["Questionnaire answers match", "Vendor claims are cross-checked against audited controls."],
    ["Evidence links form", "Every finding keeps the citation that supports it."],
    ["Confidence increases", "Direct evidence raises confidence; missing evidence lowers it."],
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <Pill icon={FileCheck2}>As the agent works</Pill>
          <h2 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
            Paper becomes evidence.
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            The interface explains each transformation: documents become controls, controls become
            citations, and citations become a risk decision security leaders can defend.
          </p>
        </div>
        <div className="relative min-h-[560px]">
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-blue-50 to-white" />
          {stages.map(([title, body], index) => (
            <motion.div
              key={title}
              className="absolute left-6 right-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/70 md:left-auto md:w-[440px]"
              style={{ top: `${index * 86 + 36}px` }}
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.08 }}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InteractiveAssessmentStory() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <Pill icon={Eye}>A living assessment</Pill>
        <h2 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
          It should feel like you are already inside the product.
        </h2>
      </div>
      <div className="mt-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Evidence expands</p>
          <motion.div
            className="mt-8 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5"
            whileInView={{ scale: [0.98, 1], opacity: [0.7, 1] }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-semibold text-blue-700">SOC2 page citation</p>
            <p className="mt-3 text-lg leading-8 text-slate-700">
              "Access controls operated effectively with no exceptions noted."
            </p>
          </motion.div>
          <div className="mt-5 grid gap-3">
            {["Questionnaire answer matched", "Breach history checked", "Control gap explained"].map((item, index) => (
              <motion.div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-slate-700">{item}</span>
              </motion.div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Decision forms</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <AnimatedNumber label="Overall Vendor Risk" value="Evidence-led" />
            <AnimatedNumber label="Assessment Confidence" value="Explained" />
            <AnimatedNumber label="Approval Status" value="Actionable" />
          </div>
          <div className="mt-8 h-2 rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
              initial={{ width: "18%" }}
              whileInView={{ width: "78%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.2 }}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            The real workspace below uses generated assessment data. This story panel explains the
            interaction pattern without inventing customer metrics.
          </p>
        </Card>
      </div>
    </section>
  );
}

function ReasoningStory() {
  const steps = ["Planning", "Retrieve Evidence", "Cross-check", "Score", "Generate Report"];
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <SectionHeader
        eyebrow="Reasoning, not magic"
        title="The product shows how it reached the decision."
        body="Enterprise reviewers should never have to accept a black-box answer. The agent exposes the plan, the evidence, the cross-check, and the deterministic score."
      />
      <div className="mt-14 grid gap-4 lg:grid-cols-5">
        {steps.map((step, index) => (
          <motion.div
            key={step}
            className="relative rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
          >
            <p className="text-sm font-semibold text-blue-600">0{index + 1}</p>
            <h3 className="mt-10 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{step}</h3>
            {index < steps.length - 1 ? (
              <motion.div
                className="absolute right-[-18px] top-1/2 hidden h-px w-9 bg-gradient-to-r from-blue-300 to-transparent lg:block"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + index * 0.08 }}
              />
            ) : null}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function TrustStory() {
  const trust = [
    ["Evidence", "Each finding points back to uploaded source material."],
    ["Citation", "Page and row references stay attached to the decision."],
    ["Confidence", "The score explains direct, partial, and missing evidence."],
    ["Reason", "Recommendations include the reason they were generated."],
    ["Framework", "SOC2, ISO 27001, and GDPR context stays visible."],
    ["No hallucinated scores", "Risk is calculated by deterministic Python rules."],
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 md:p-12">
        <SectionHeader
          eyebrow="Trust"
          title="Why security teams can defend the output."
          body="The agent can help read and plan, but it never invents a risk score. The final answer is anchored to evidence and deterministic scoring."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trust.map(([title, body], index) => (
            <motion.div
              key={title}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <p className="font-semibold text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FrameworkConstellation({ frameworks }: { frameworks: FrameworkControl[] }) {
  const names = Array.from(new Set([...frameworks.map((control) => control.framework), "NIST"]));
  return (
    <section id="frameworks-story" className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <Pill icon={Layers3}>Framework intelligence</Pill>
        <h2 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
          Frameworks orbit the same evidence.
        </h2>
      </div>
      <div className="relative mx-auto mt-16 min-h-[420px] max-w-5xl rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-600/20">
          <div className="flex h-full items-center justify-center text-center text-sm font-semibold">Evidence</div>
        </div>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <line x1="50%" y1="50%" x2="18%" y2="22%" stroke="#BFDBFE" strokeWidth="2" strokeDasharray="6 8" />
          <line x1="50%" y1="50%" x2="82%" y2="24%" stroke="#BFDBFE" strokeWidth="2" strokeDasharray="6 8" />
          <line x1="50%" y1="50%" x2="20%" y2="78%" stroke="#BFDBFE" strokeWidth="2" strokeDasharray="6 8" />
          <line x1="50%" y1="50%" x2="80%" y2="76%" stroke="#BFDBFE" strokeWidth="2" strokeDasharray="6 8" />
        </svg>
        {names.slice(0, 4).map((name, index) => {
          const positions = ["left-[8%] top-[12%]", "right-[8%] top-[14%]", "left-[10%] bottom-[14%]", "right-[10%] bottom-[16%]"];
          const count = frameworks.filter((control) => control.framework === name).length;
          return (
            <motion.div
              key={name}
              className={`absolute ${positions[index]} rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}
              whileHover={{ scale: 1.04 }}
            >
              <p className="text-xl font-semibold text-slate-950">{name}</p>
              <p className="mt-2 text-sm text-slate-500">
                {count ? `${count} mapped controls` : "Future mapping surface"}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function LivingDashboardStory() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <SectionHeader
        eyebrow="Living dashboard"
        title="The dashboard should answer what changed, not just what happened."
        body="Once assessments exist, the workspace below turns generated reports into risk movement, confidence movement, framework usage, and attention areas."
      />
      <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="grid gap-4 md:grid-cols-3">
            {["Risk changes", "Confidence grows", "Evidence expands"].map((item, index) => (
              <motion.div key={item} className="rounded-[1.5rem] bg-slate-50 p-5" whileInView={{ y: [12, 0], opacity: [0.5, 1] }} viewport={{ once: true }} transition={{ delay: index * 0.12 }}>
                <p className="text-sm text-slate-500">{item}</p>
                <div className="mt-8 h-2 rounded-full bg-slate-200">
                  <motion.div className="h-full rounded-full bg-blue-600" initial={{ width: "8%" }} whileInView={{ width: `${45 + index * 18}%` }} viewport={{ once: true }} />
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">PDF highlights</p>
          <div className="mt-6 space-y-3">
            {["Referenced SOC2 page", "Questionnaire answer", "Scoring paragraph"].map((item, index) => (
              <motion.div key={item} className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-medium text-blue-800" initial={{ opacity: 0.3 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: index * 0.15 }}>
                {item}
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function PipelineStory() {
  const nodes = ["Upload", "Parser", "Planning", "Evidence Retrieval", "Cross-check", "Reasoning", "Deterministic Scoring", "Executive Report"];
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
      <SectionHeader
        eyebrow="Architecture"
        title="A flowing pipeline from paperwork to decision."
        body="No boxes for the sake of boxes. Each stage exists to preserve evidence, context, and auditability."
      />
      <div className="relative mt-14 overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="absolute left-12 right-12 top-1/2 h-1 rounded-full bg-blue-100" />
        <motion.div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-blue-600 shadow-[0_0_24px_rgba(37,99,235,0.55)]"
          animate={{ left: ["3rem", "calc(100% - 3rem)"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative grid gap-4 md:grid-cols-4">
          {nodes.map((node, index) => (
            <motion.div key={node} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
              <p className="text-xs font-semibold text-blue-600">0{index + 1}</p>
              <p className="mt-8 font-semibold text-slate-950">{node}</p>
            </motion.div>
          ))}
        </div>
      </div>
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
        eyebrow="Assessment workflow"
        title="One continuous path from upload to decision."
        body="The workspace keeps the user oriented as evidence moves from documents to live analysis, review, risk assessment, decision summary, export, and history."
      />
      <JourneyProgress loading={props.loading} records={props.records} trace={props.trace} activeRecord={props.activeRecord} />
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

function JourneyProgress({
  activeRecord,
  loading,
  records,
  trace,
}: {
  activeRecord: AssessmentRecord | null;
  loading: boolean;
  records: AssessmentRecord[];
  trace: TraceEvent[];
}) {
  const steps = [
    "Welcome",
    "Upload Documents",
    "Live AI Analysis",
    "Evidence Review",
    "Risk Assessment",
    "Decision Summary",
    "Export",
    "History",
  ];
  const current = loading
    ? 2
    : activeRecord
      ? 5
      : records.length
        ? 7
        : trace.length
          ? 2
          : 1;

  return (
    <div className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm" aria-label="Assessment workflow progress">
      <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-8">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <div key={step} className="flex items-center gap-2 rounded-2xl px-3 py-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  complete ? "bg-green-100 text-green-700" : active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`text-xs font-medium ${active ? "text-blue-700" : complete ? "text-slate-700" : "text-slate-400"}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProcessingChecklist({
  loading,
  trace,
  uploadProgress,
}: {
  loading: boolean;
  trace: TraceEvent[];
  uploadProgress: number;
}) {
  const items = [
    ["Reading SOC2 report", trace.some((event) => event.step === "ingest") || uploadProgress > 8],
    ["Extracting controls", trace.some((event) => event.step === "plan")],
    ["Matching questionnaire", trace.some((event) => event.step === "cross_reference")],
    ["Searching breach history", trace.some((event) => event.step === "tool")],
    ["Computing deterministic risk", trace.some((event) => event.step === "reason")],
    ["Generating executive summary", trace.some((event) => event.step === "output" || event.step === "complete")],
  ];

  if (!loading && !trace.length) {
    return null;
  }

  return (
    <div className="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-4">
      <p className="text-sm font-semibold text-blue-900">Live analysis status</p>
      <div className="mt-4 grid gap-2">
        {items.map(([label, complete], index) => (
          <motion.div
            key={label as string}
            className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${complete ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
              {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            <span className={complete ? "text-slate-800" : "text-slate-500"}>{label as string}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DecisionPanel({ record }: { record: AssessmentRecord }) {
  const brief = record.brief;
  const approvalStatus = brief.overall_risk_score > 65 ? "Escalate" : brief.flagged_gaps.length ? "Conditional approval" : "Ready for approval";
  const reviewTimeSaved = brief.categories.length
    ? `${Math.max(1, brief.categories.length * 2)}+ manual review steps avoided`
    : "Manual evidence review avoided";

  return (
    <div className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white shadow-xl shadow-blue-600/20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">Decision summary</p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{recommendation(brief)}</h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-50">
            This recommendation is based on cited evidence, detected gaps, breach signals, and the deterministic scoring rules used by the assessment engine.
          </p>
        </div>
        <RiskBadge level={brief.overall_risk_level} score={brief.overall_risk_score} />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <DecisionMetric label="Overall Vendor Risk" value={`${brief.overall_risk_score}/100`} />
        <DecisionMetric label="Assessment Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
        <DecisionMetric label="Critical Findings" value={String(brief.flagged_gaps.length)} />
        <DecisionMetric label="Approval Status" value={approvalStatus} />
        <DecisionMetric label="Review Time Saved" value={reviewTimeSaved} wide />
        <DecisionMetric label="Verified Security Controls" value={String(brief.categories.length)} />
      </div>
    </div>
  );
}

function DecisionMetric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 ${wide ? "md:col-span-2 lg:col-span-1" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-6 text-white">{value}</p>
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
        <ProcessingChecklist trace={trace} loading={loading} uploadProgress={uploadProgress} />
        <TracePanel trace={trace} loading={loading} />
      </Card>

      <Card>
        <CardHeader icon={Eye} title="Assessment page" subtitle="Split view for risk, timeline, evidence, gaps, recommendations, and citations." />
        {activeRecord ? (
          <div className="mt-6 grid gap-5">
            <DecisionPanel record={activeRecord} />
            <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
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
          </div>
        ) : (
          <EmptyState
            icon={FileCheck2}
            title="Run your first assessment"
            body="Upload a SOC2 report and questionnaire to generate a decision summary, evidence review, gap analysis, generated questions, and cited recommendations."
            ctaHref="#assessment"
            ctaLabel="Upload documents"
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
          <MiniMetric label="Overall Vendor Risk" value={`${brief.overall_risk_score}/100`} />
          <MiniMetric label="Assessment Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
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
        <button onClick={() => exportRecord("pdf", record)} className="btn-secondary"><Download className="h-4 w-4" /> Executive Report</button>
        <button onClick={() => exportRecord("markdown", record)} className="btn-secondary"><FileText className="h-4 w-4" /> Technical Report</button>
        <button onClick={() => exportRecord("json", record)} className="btn-secondary"><FileJson className="h-4 w-4" /> JSON Evidence</button>
        <button onClick={copyShareLink} className="btn-secondary"><LinkIcon className="h-4 w-4" /> Share link</button>
      </div>
      <ExportPreview brief={brief} />
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
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Confidence improves when more selected controls have direct SOC2 evidence and matching
          questionnaire support. It decreases when evidence is partial, missing, or contradicted by
          breach history.
        </p>
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
  const compared = records.slice(0, 3);
  const safest = compared.length
    ? compared.reduce((best, record) =>
        record.brief.overall_risk_score < best.brief.overall_risk_score ? record : best,
      )
    : null;
  return (
    <div className="mt-14" id="comparison">
      <SectionHeader
        eyebrow="Vendor comparison"
        title="Which vendor is safer, and why?"
        body="The comparison scorecard focuses on the decision: risk, confidence, missing evidence, breach signals, control coverage, and recommendation."
      />
      <Card className="mt-8">
        {compared.length ? (
          <>
            {safest ? (
              <div className="mb-6 rounded-[1.5rem] border border-green-100 bg-green-50 p-5">
                <p className="text-sm font-semibold text-green-800">
                  Safer vendor based on current evidence: {safest.brief.vendor_name}
                </p>
                <p className="mt-2 text-sm leading-6 text-green-700">
                  Lowest overall vendor risk, {Math.round(safest.brief.confidence_score * 100)}%
                  assessment confidence, {safest.brief.categories.length} verified security control
                  categories, and {safest.brief.flagged_gaps.length} finding(s) requiring review.
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-3">
              {compared.map((record) => {
                const brief = record.brief;
                return (
                  <motion.div key={record.id} whileHover={{ y: -4 }} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-950">{brief.vendor_name}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation(brief)}</p>
                      </div>
                      <RiskBadge level={brief.overall_risk_level} score={brief.overall_risk_score} />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <MiniMetric label="Assessment Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
                      <MiniMetric label="Verified Controls" value={String(brief.categories.length)} />
                      <MiniMetric label="Breach Signals" value={String(brief.breach_history.length)} />
                      <MiniMetric label="Missing Evidence" value={String(brief.confidence_breakdown.no_evidence_controls)} />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {["SOC2", "ISO27001", "GDPR"].map((framework) => (
                        <span key={framework} className={`rounded-full px-3 py-1 text-xs font-semibold ${brief.plan.frameworks.includes(framework) ? "bg-blue-100 text-blue-700" : "bg-white text-slate-400"}`}>
                          {framework}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Scale}
            title="No vendors to compare yet"
            body="Upload two or more vendors to see a side-by-side scorecard explaining which vendor is safer and what evidence differs."
            ctaHref="#assessment"
            ctaLabel="Upload vendors"
          />
        )}
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
        title="A timeline of risk movement, not a filing cabinet."
        body="Each assessment becomes a point in the vendor story: what changed, what improved, which findings appeared, and what evidence still needs review."
      />
      <Card className="mt-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
        <div className="mt-8">
          {visible.length ? (
            <div className="relative grid gap-5">
              <div className="absolute bottom-8 left-5 top-4 w-px bg-slate-200" />
              {visible.map((record, index) => {
                const previous = sorted[index + 1];
                const riskDelta = previous ? record.brief.overall_risk_score - previous.brief.overall_risk_score : 0;
                const confidenceDelta = previous ? Math.round((record.brief.confidence_score - previous.brief.confidence_score) * 100) : 0;
                return (
                  <motion.div
                    key={record.id}
                    className="relative ml-10 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                  >
                    <span className="absolute -left-[3.05rem] top-6 h-4 w-4 rounded-full border-4 border-white bg-blue-600 shadow" />
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm text-slate-500">{new Date(record.createdAt).toLocaleString()}</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-950">{record.brief.vendor_name}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{historyInsight(record, previous)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <RiskBadge level={record.brief.overall_risk_level} score={record.brief.overall_risk_score} />
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          Confidence {Math.round(record.brief.confidence_score * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <MiniMetric label="Risk trend" value={riskDelta > 0 ? `+${riskDelta}` : String(riskDelta)} />
                      <MiniMetric label="Confidence trend" value={confidenceDelta > 0 ? `+${confidenceDelta}%` : `${confidenceDelta}%`} />
                      <MiniMetric label="New findings" value={String(record.brief.flagged_gaps.length)} />
                      <MiniMetric label="Resolved findings" value={previous ? String(Math.max(0, previous.brief.flagged_gaps.length - record.brief.flagged_gaps.length)) : "0"} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setActiveId(record.id)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-blue-200 hover:text-blue-700">Open assessment</button>
                      <button onClick={() => exportRecord("json", record)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-blue-200 hover:text-blue-700">Export JSON</button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="No assessment history yet"
              body="Upload your first SOC2 report to begin a vendor assessment. Each completed run will appear here as a risk timeline with changes and findings."
              ctaHref="#assessment"
              ctaLabel="Start first assessment"
            />
          )}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
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
        <div className="mt-3 grid gap-3 lg:grid-cols-[0.25fr_0.75fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Pages</p>
            <div className="mt-3 grid gap-2">
              {[page ?? "1", String(Number(page ?? "1") + 1), String(Number(page ?? "1") + 2)].map((item, index) => (
                <a
                  key={`${item}-${index}`}
                  href={pdfUrl ? `${pdfUrl}#page=${item}` : undefined}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${index === 0 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-200"}`}
                >
                  Page {item}
                </a>
              ))}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{citation.source} · {citation.location}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{citation.quote}</p>
            <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-blue-700">
              Highlighted paragraph contributed to scoring.
            </p>
          </div>
          <div className="min-h-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {src ? <iframe title="Evidence PDF preview" src={src} className="h-64 w-full" /> : <div className="flex h-52 items-center justify-center p-6 text-center text-sm text-slate-500">Upload a SOC2 PDF in this session to jump to cited pages.</div>}
          </div>
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
      {questions.map((question, index) => (
        <div key={question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex gap-3 text-sm leading-6 text-slate-700">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          {question}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <MiniMetric label="Reason" value={brief.flagged_gaps[index]?.gap ? "Detected gap" : "Review assurance"} />
            <MiniMetric label="Evidence" value={brief.flagged_gaps[index]?.citations?.length ? "Cited" : "Needs vendor proof"} />
            <MiniMetric label="Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExportPreview({ brief }: { brief: RiskBrief }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Report preview</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[
          ["Executive Report", `${brief.vendor_name}: ${recommendation(brief)} with ${Math.round(brief.confidence_score * 100)}% confidence.`],
          ["Technical Report", `${brief.categories.length} control categories, ${brief.flagged_gaps.length} finding(s), cited evidence included.`],
          ["Procurement Summary", recommendation(brief)],
          ["Legal Summary", brief.plan.frameworks.includes("GDPR") ? "GDPR processor obligations were considered." : "No GDPR-specific category was selected by the plan."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-950">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </div>
        ))}
      </div>
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

function AnimatedNumber({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-8 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
    </motion.div>
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

function EmptyState({
  body,
  ctaHref,
  ctaLabel,
  icon: Icon,
  title,
}: {
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-gradient-to-br from-white to-blue-50 p-8 text-center">
      <div className="mx-auto mb-6 grid h-24 w-32 place-items-center rounded-[2rem] border border-blue-100 bg-white shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="h-6 w-6" /></span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
      {ctaHref && ctaLabel ? (
        <a href={ctaHref} className="btn-primary mt-5">
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </a>
      ) : null}
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

function historyInsight(record: AssessmentRecord, previous?: AssessmentRecord) {
  if (!previous) {
    return "Baseline assessment created. Future runs will show improvements, regressions, new findings, and resolved findings.";
  }
  const riskDelta = record.brief.overall_risk_score - previous.brief.overall_risk_score;
  const confidenceDelta = record.brief.confidence_score - previous.brief.confidence_score;
  if (riskDelta < 0) {
    return "Vendor risk decreased compared to the previous assessment.";
  }
  if (riskDelta > 0) {
    return "Vendor risk increased and should be reviewed before approval.";
  }
  if (confidenceDelta > 0) {
    return "Assessment confidence increased after stronger evidence was validated.";
  }
  return "Risk is stable compared with the previous assessment.";
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
