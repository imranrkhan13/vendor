"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  Fingerprint,
  GitBranch,
  GanttChartSquare,
  LucideIcon,
  Network,
  Radar,
  Scale,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  TimerReset,
} from "lucide-react";

import { Citation, RiskBrief, TraceEvent, streamAssessmentTrace } from "../lib/api";

const repoUrl = "https://github.com/imranrkhan13/vendor";

const problemSteps = [
  "Download SOC2",
  "Read 120 pages",
  "Compare questionnaire",
  "Search breach history",
  "Email security",
  "Wait days",
  "Approve manually",
];

const howItWorks = [
  { title: "Upload documents", body: "SOC2, questionnaire, and optional breach context enter one review run." },
  { title: "Parse SOC2", body: "The parser extracts page-grounded chunks and auditor-opinion language." },
  { title: "Match controls", body: "Framework mappings align SOC2, ISO 27001, and GDPR categories." },
  { title: "Retrieve evidence", body: "The agent performs SOC2 retrieval, then questionnaire cross-checking." },
  { title: "Score risk", body: "Python rules compute gaps, risk, and confidence without LLM scores." },
  { title: "Generate report", body: "The final brief includes citations, gaps, follow-ups, and trace." },
];

const frameworkCards = [
  { name: "SOC2", coverage: "Trust Services Criteria", compliance: "CC6, CC7, CC8, A1", evidence: "Auditor tests + control excerpts" },
  { name: "ISO 27001", coverage: "Annex A controls", compliance: "A.5, A.8, A.9, A.12", evidence: "Mapped operational controls" },
  { name: "GDPR", coverage: "Processor obligations", compliance: "Art. 28, 32, 33", evidence: "Data protection + breach signals" },
];

const workflowNodes = [
  "Upload",
  "Planning",
  "Evidence Retrieval",
  "Questionnaire Cross-check",
  "Breach Lookup",
  "Deterministic Risk Scoring",
  "Risk Brief",
];

const enterpriseAudiences = [
  { icon: ShieldCheck, title: "Security teams", body: "Triage vendor posture before the review queue grows." },
  { icon: ClipboardCheck, title: "Compliance", body: "Preserve evidence chains for audit-ready decisions." },
  { icon: Scale, title: "Procurement", body: "Know contract risk before commercial urgency takes over." },
  { icon: BookOpenCheck, title: "Legal", body: "Surface processor and breach-notification obligations early." },
  { icon: Network, title: "Vendor Management", body: "Track consistent follow-ups across every supplier." },
];

const architecture = [
  "Parser",
  "Framework Registry",
  "Planning Agent",
  "Evidence Retrieval",
  "Scoring Engine",
  "FastAPI",
  "Next.js",
  "Risk Report",
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  const [brief, setBrief] = useState<RiskBrief | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const soc2File = formData.get("soc2_report");

    if (soc2File instanceof File) {
      setPdfUrl(URL.createObjectURL(soc2File));
    }

    setBrief(null);
    setTrace([]);
    setSelectedCitation(null);
    setError(null);
    setLoading(true);

    try {
      const result = await streamAssessmentTrace(formData, (traceEvent) => {
        setTrace((current) => [...current, traceEvent]);
      });
      setBrief(result);
      const firstCitation = result.categories.flatMap((category) => category.citations)[0];
      if (firstCitation) {
        setSelectedCitation(firstCitation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative overflow-hidden">
      <div className="grain pointer-events-none fixed inset-0 z-0 opacity-[0.07]" />
      <div className="subtle-grid pointer-events-none absolute inset-x-0 top-0 z-0 h-[860px]" />
      <Hero />
      <Problem />
      <HowItWorks />
      <FrameworkIntelligence />
      <AgentWorkflow />
      <DashboardPreview />
      <DemoAssessment
        brief={brief}
        error={error}
        loading={loading}
        onSubmit={onSubmit}
        pdfUrl={pdfUrl}
        selectedCitation={selectedCitation}
        setSelectedCitation={setSelectedCitation}
        trace={trace}
      />
      <ExampleAssessment />
      <DeterministicScoring />
      <BuiltForEnterprise />
      <Architecture />
      <OpenSource />
      <FinalCta />
    </main>
  );
}

function Hero() {
  return (
    <Section className="min-h-screen pt-8">
      <nav className="relative z-10 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.035] px-5 py-3 backdrop-blur-2xl">
        <div className="flex items-center gap-3 text-sm text-stone-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <Fingerprint className="h-4 w-4" />
          </div>
          Vendor Risk Assessment Agent
        </div>
        <a className="hidden text-sm text-stone-400 transition hover:text-stone-100 md:block" href={repoUrl}>
          View source
        </a>
      </nav>

      <div className="grid items-center gap-12 py-24 lg:grid-cols-[1.02fr_0.98fr] lg:py-32">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.8 }} className="relative z-10">
          <Pill>Vultr track · AI security review agent</Pill>
          <h1 className="mt-8 max-w-5xl text-6xl font-semibold tracking-[-0.075em] text-stone-50 md:text-8xl lg:text-[7.8rem] lg:leading-[0.86]">
            Stop spending weeks reviewing vendor security.
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-8 text-stone-400 md:text-2xl">
            Know the risk before you sign the contract. The agent reads SOC2 reports,
            questionnaires, and breach history, then returns an evidence-backed assessment with
            deterministic scores.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#demo" className="group inline-flex items-center justify-center rounded-full bg-stone-100 px-6 py-3 text-sm font-medium text-stone-950 transition hover:bg-white">
              Try Demo <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a href={repoUrl} className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-stone-200 backdrop-blur-xl transition hover:bg-white/[0.08]">
              <GitBranch className="mr-2 h-4 w-4" /> View GitHub
            </a>
          </div>
        </motion.div>
        <HeroDashboard />
      </div>
    </Section>
  );
}

function HeroDashboard() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-240, 240], [8, -8]);
  const rotateY = useTransform(mouseX, [-240, 240], [-8, 8]);
  const glow = useMotionTemplate`radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(245,243,238,0.16), transparent 32%)`;

  return (
    <motion.div
      className="relative z-10 mx-auto w-full max-w-xl"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        mouseX.set(event.clientX - rect.left - rect.width / 2);
        mouseY.set(event.clientY - rect.top - rect.height / 2);
      }}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, scale: 0.94, y: 26 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.18 }}
    >
      <motion.div className="pointer-events-none absolute inset-0 rounded-[2rem]" style={{ background: glow }} />
      <div className="glass relative overflow-hidden rounded-[2rem] p-5">
        <motion.div className="scan-line absolute left-0 top-20 h-px w-full" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }} />
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">Live security review</p>
            <h3 className="mt-1 text-xl font-medium text-stone-100">Acme Cloud</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-stone-300">
            <span className="h-2 w-2 rounded-full bg-stone-200 shadow-[0_0_16px_rgba(245,243,238,0.8)]" />
            Live scanning
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AnimatedMetric label="Risk score" value="42" suffix="/100" />
          <AnimatedMetric label="Confidence" value="78" suffix="%" />
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-stone-300">SOC2 parsing</span>
            <span className="text-xs text-stone-500">CC6 · CC7 · A1</span>
          </div>
          {["Controls verified", "Questionnaire matched", "Breach history checked"].map((item, index) => (
            <motion.div
              className="mb-3 last:mb-0"
              key={item}
              initial={{ opacity: 0.35 }}
              animate={{ opacity: [0.35, 1, 0.65] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.35 }}
            >
              <div className="mb-1 flex justify-between text-xs text-stone-400">
                <span>{item}</span>
                <span>{index === 0 ? "12/15" : index === 1 ? "8 answers" : "1 signal"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-stone-500 to-stone-100"
                  initial={{ width: "18%" }}
                  animate={{ width: index === 0 ? "78%" : index === 1 ? "62%" : "42%" }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {["SOC2", "ISO 27001", "GDPR"].map((badge) => (
            <motion.div
              key={badge}
              className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-center text-xs text-stone-300"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, delay: badge.length * 0.12 }}
            >
              {badge}
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-stone-500">Vendor timeline</p>
          <div className="relative">
            <div className="absolute left-2 top-2 h-[72px] w-px bg-gradient-to-b from-stone-200/70 to-transparent" />
            {["SOC2 uploaded", "CC6 gap detected", "Risk brief ready"].map((event, index) => (
              <motion.div
                key={event}
                className="relative mb-3 flex items-center gap-3 text-sm text-stone-300 last:mb-0"
                initial={{ opacity: 0.45, x: -8 }}
                animate={{ opacity: [0.45, 1, 0.45], x: 0 }}
                transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
              >
                <span className="z-10 h-4 w-4 rounded-full border border-stone-200/70 bg-stone-950" />
                {event}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Problem() {
  return (
    <Section>
      <SectionHeader eyebrow="The problem" title="A vendor review is still a detective story." body="Security teams jump across PDFs, spreadsheets, inboxes, and breach searches just to answer one question: can we trust this vendor?" />
      <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="glass rounded-[2rem] p-5">
          {problemSteps.map((step, index) => (
            <motion.div
              key={step}
              className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-stone-300 last:mb-0"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              transition={{ delay: index * 0.06 }}
            >
              <span>{step}</span>
              <span className="text-xs text-stone-600">0{index + 1}</span>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center justify-center text-stone-500">
          <ArrowRight className="hidden h-8 w-8 lg:block" />
          <ArrowDown className="h-8 w-8 lg:hidden" />
        </div>
        <div className="glass flex flex-col justify-center rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Vendor Risk Agent</p>
          <div className="mt-8 grid gap-4">
            {["Upload", "Analyze", "Decision"].map((step, index) => (
              <motion.div
                key={step}
                className="flex items-center gap-4 text-3xl font-medium tracking-[-0.04em] text-stone-100"
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-sm text-stone-400">
                  {index + 1}
                </span>
                {step}
              </motion.div>
            ))}
          </div>
          <div className="mt-10 text-6xl font-semibold tracking-[-0.07em] text-stone-50">30 seconds.</div>
        </div>
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section>
      <SectionHeader eyebrow="How it works" title="One continuous review, from evidence to decision." body="The agent does not stop at retrieval. It plans, cross-checks, calls tools, reasons over conflicts, and emits an auditable brief." />
      <div className="mt-14 grid gap-4 lg:grid-cols-6">
        {howItWorks.map((item, index) => (
          <motion.div
            key={item.title}
            className="glass rounded-[1.75rem] p-5 lg:min-h-[260px]"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            transition={{ delay: index * 0.05 }}
          >
            <span className="text-sm text-stone-500">0{index + 1}</span>
            <h3 className="mt-8 text-2xl font-medium tracking-[-0.04em] text-stone-100">{item.title}</h3>
            <p className="mt-4 text-sm leading-6 text-stone-400">{item.body}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

function FrameworkIntelligence() {
  return (
    <Section>
      <SectionHeader eyebrow="Framework intelligence" title="Control mappings, not keyword soup." body="SOC2, ISO 27001, and GDPR are normalized into review categories the agent can compare against both audited and self-reported evidence." />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {frameworkCards.map((framework, index) => (
          <motion.div
            key={framework.name}
            className="glass group min-h-[320px] overflow-hidden rounded-[2rem] p-6 transition duration-500 hover:-translate-y-2 hover:bg-white/[0.08]"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-semibold tracking-[-0.06em] text-stone-50">{framework.name}</h3>
              <BadgeCheck className="h-5 w-5 text-stone-500 transition group-hover:text-stone-100" />
            </div>
            <p className="mt-8 text-stone-400">{framework.coverage}</p>
            <div className="mt-8 grid gap-3 opacity-80 transition group-hover:opacity-100">
              <Detail label="Control mappings" value={framework.compliance} />
              <Detail label="Compliance %" value="Computed from matched evidence" />
              <Detail label="Evidence matched" value={framework.evidence} />
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

function AgentWorkflow() {
  return (
    <Section>
      <SectionHeader eyebrow="Agent workflow" title="The part judges need to see: a real multi-step agent." body="Every transition is explicit: planning, two retrieval passes, a tool call, deterministic reasoning, and a cited brief." />
      <div className="glass mt-14 overflow-hidden rounded-[2.5rem] p-6">
        <div className="grid gap-4 md:grid-cols-7">
          {workflowNodes.map((node, index) => (
            <motion.div
              key={node}
              className="relative rounded-3xl border border-white/10 bg-black/25 p-4 text-center"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <motion.div className="mx-auto mb-4 h-2 w-2 rounded-full bg-stone-200" animate={{ boxShadow: ["0 0 0 rgba(245,243,238,0)", "0 0 28px rgba(245,243,238,0.55)", "0 0 0 rgba(245,243,238,0)"] }} transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.18 }} />
              <p className="text-sm text-stone-300">{node}</p>
              {index < workflowNodes.length - 1 ? (
                <motion.div className="absolute right-[-18px] top-1/2 z-10 hidden h-px w-9 bg-gradient-to-r from-stone-500 to-transparent md:block" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + index * 0.09 }} />
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function DashboardPreview() {
  return (
    <Section>
      <SectionHeader eyebrow="Illustrative Preview" title="What an enterprise review screen should feel like." body="A realistic dashboard preview built in React: risk, confidence, gaps, evidence, framework coverage, and follow-ups in one decision surface." />
      <div className="glass mt-14 grid gap-5 rounded-[2.5rem] p-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-5">
          <PreviewPanel title="Overall Risk" value="Medium" icon={Radar} />
          <PreviewPanel title="Confidence" value="78%" icon={Sparkles} />
          <PreviewPanel title="Vendor Score" value="42 / 100" icon={GanttChartSquare} />
        </div>
        <div className="grid gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <PreviewList title="Missing Controls" items={["CC6.1 evidence incomplete", "Art. 33 notification detail missing"]} />
            <PreviewList title="Failed Controls" items={["MFA planned, not enforced", "Breach follow-up unresolved"]} />
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
            <PreviewList title="Recommended Follow-ups" items={["Send MFA enforcement attestation", "Confirm breach-notification SLA", "Provide latest access review"]} />
            <FrameworkBars />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <RiskTimeline />
            <EvidenceViewerMini />
          </div>
        </div>
      </div>
    </Section>
  );
}

function DemoAssessment({
  brief,
  error,
  loading,
  onSubmit,
  pdfUrl,
  selectedCitation,
  setSelectedCitation,
  trace,
}: {
  brief: RiskBrief | null;
  error: string | null;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pdfUrl: string | null;
  selectedCitation: Citation | null;
  setSelectedCitation: (citation: Citation) => void;
  trace: TraceEvent[];
}) {
  return (
    <Section id="demo">
      <SectionHeader eyebrow="Live demo" title="Watch the agent think, then verify the evidence." body="Upload documents once. The trace panel streams the reasoning path, citations become clickable, and the confidence score explains itself." />
      <div className="mt-14 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <form className="glass rounded-[2rem] p-6" onSubmit={onSubmit}>
          <h3 className="text-3xl font-medium tracking-[-0.05em] text-stone-100">Run assessment</h3>
          <div className="mt-6 grid gap-4">
            <Field label="Vendor name">
              <input name="vendor_name" required placeholder="Acme Cloud" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-white/25" />
            </Field>
            <Field label="SOC2 Type II report">
              <input name="soc2_report" type="file" accept="application/pdf" required className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-400 file:mr-4 file:rounded-full file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-sm file:text-stone-950" />
            </Field>
            <Field label="Security questionnaire">
              <input name="questionnaire" type="file" accept=".json,.csv" required className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-400 file:mr-4 file:rounded-full file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-sm file:text-stone-950" />
            </Field>
            <Field label="Optional breach history">
              <input name="breach_history" type="file" accept=".txt,.md,.csv,.json" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-400 file:mr-4 file:rounded-full file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-sm file:text-stone-950" />
            </Field>
          </div>
          <button disabled={loading} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Streaming reasoning trace..." : "Try demo"}
          </button>
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          <p className="mt-5 text-sm leading-6 text-stone-500">
            For a gap demonstration, use a questionnaire answer such as "MFA is planned" while
            SOC2 evidence describes effective access controls.
          </p>
        </form>

        <div className="grid gap-6">
          <TracePanel trace={trace} loading={loading} />
          {brief ? (
            <RiskBriefPanel brief={brief} onCitationClick={setSelectedCitation} selectedCitation={selectedCitation} />
          ) : (
            <div className="glass rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Awaiting documents</p>
              <h3 className="mt-3 text-3xl font-medium tracking-[-0.05em] text-stone-100">Risk brief appears here.</h3>
              <p className="mt-4 text-stone-400">Judges will see the plan, evidence matches, gaps, deterministic score, and citations in one panel.</p>
            </div>
          )}
          <CitationSourcePanel citation={selectedCitation} pdfUrl={pdfUrl} />
        </div>
      </div>
    </Section>
  );
}

function TracePanel({ trace, loading }: { trace: TraceEvent[]; loading: boolean }) {
  return (
    <div className="glass rounded-[2rem] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Live reasoning trace</p>
          <h3 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-stone-100">Agent thinking</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400">
          <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-stone-100" : "bg-stone-600"}`} />
          {loading ? "Streaming" : "Ready"}
        </div>
      </div>
      <div className="mt-5 max-h-[320px] overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4">
        {(trace.length ? trace : [{ step: "idle", message: "Upload documents to stream planning, retrieval, cross-checking, breach lookup, and deterministic scoring." }]).map((event, index) => (
          <motion.div
            key={`${event.step}-${event.message}-${index}`}
            className="mb-3 flex gap-3 text-sm last:mb-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
            <div>
              <p className="font-medium capitalize text-stone-300">{event.step.replace("_", " ")}</p>
              <p className="text-stone-500">{event.message}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RiskBriefPanel({
  brief,
  onCitationClick,
  selectedCitation,
}: {
  brief: RiskBrief;
  onCitationClick: (citation: Citation) => void;
  selectedCitation: Citation | null;
}) {
  return (
    <div className="glass rounded-[2rem] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">{brief.vendor_name}</p>
          <h3 className="mt-2 text-3xl font-medium tracking-[-0.05em] text-stone-100">Structured risk brief</h3>
        </div>
        <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-stone-300">
          {brief.overall_risk_level} risk
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Metric label="Overall risk" value={`${brief.overall_risk_score}/100`} />
        <Metric label="Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
        <Metric label="Missing controls" value={`${brief.confidence_breakdown.no_evidence_controls}`} />
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-stone-200">Confidence breakdown</p>
        <p className="mt-2 text-sm leading-6 text-stone-400">{brief.confidence_breakdown.formula}</p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <SmallStat label="Direct" value={brief.confidence_breakdown.direct_evidence_controls} />
          <SmallStat label="Partial" value={brief.confidence_breakdown.partial_evidence_controls} />
          <SmallStat label="No evidence" value={brief.confidence_breakdown.no_evidence_controls} />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {brief.categories.slice(0, 4).map((finding) => (
          <div key={finding.category} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h4 className="text-lg font-medium capitalize tracking-[-0.03em] text-stone-100">{finding.category.replaceAll("_", " ")}</h4>
              <span className="text-sm text-stone-500">Score {finding.score}/100 · {finding.status}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-400">{finding.rationale}</p>
            {finding.gaps.slice(0, 2).map((gap) => (
              <p key={gap} className="mt-2 text-sm text-red-300">Gap: {gap}</p>
            ))}
            <div className="mt-3 flex flex-wrap gap-2">
              {finding.citations.slice(0, 3).map((citation, index) => {
                const active = selectedCitation?.source === citation.source && selectedCitation.location === citation.location;
                return (
                  <button
                    key={`${citation.source}-${citation.location}-${index}`}
                    type="button"
                    onClick={() => onCitationClick(citation)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-stone-100 bg-stone-100 text-stone-950" : "border-white/10 bg-black/20 text-stone-400 hover:border-white/25 hover:text-stone-100"}`}
                  >
                    {citation.source} · {citation.location}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CitationSourcePanel({ citation, pdfUrl }: { citation: Citation | null; pdfUrl: string | null }) {
  const page = useMemo(() => {
    if (!citation) return null;
    const match = citation.location.match(/\d+/);
    return match ? match[0] : null;
  }, [citation]);
  const pdfSrc = pdfUrl && page ? `${pdfUrl}#page=${page}` : pdfUrl;

  return (
    <div className="glass rounded-[2rem] p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Citation highlighting</p>
          <h3 className="mt-2 text-2xl font-medium tracking-[-0.04em] text-stone-100">Source evidence</h3>
        </div>
        <FileSearch className="h-5 w-5 text-stone-500" />
      </div>
      {citation ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm text-stone-300">{citation.source} · {citation.location}</p>
            <p className="mt-3 rounded-2xl border border-white/10 bg-stone-100/[0.06] p-4 text-sm leading-6 text-stone-300">
              {citation.quote}
            </p>
          </div>
          <div className="min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-black/25">
            {pdfSrc ? (
              <iframe title="SOC2 citation preview" src={pdfSrc} className="h-[320px] w-full opacity-80" />
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center p-6 text-center text-sm text-stone-500">
                Upload a SOC2 PDF, then click a citation to jump to its page.
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-stone-500">Click a generated citation to view its excerpt and jump to the uploaded PDF page.</p>
      )}
    </div>
  );
}

function ExampleAssessment() {
  return (
    <Section>
      <SectionHeader eyebrow="Example assessment" title="The gap is obvious because the evidence is next to the answer." body="The agent compares what the auditor tested against what the vendor says today, then explains the discrepancy with citations." />
      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Source material</p>
          <SourceExcerpt title="SOC2 excerpt" body="CC6 logical access controls were suitably designed and operated effectively. No exceptions were noted during the review period." citation="SOC2 Section CC6 · page 12" />
          <SourceExcerpt title="Questionnaire answer" body="Administrator MFA is planned for the next quarter. Current enforcement is limited to production break-glass accounts." citation="Questionnaire · row 4" />
        </div>
        <div className="glass rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Generated risk brief</p>
          <div className="mt-5 grid gap-3">
            <Detail label="Risk" value="Medium: access-control discrepancy" />
            <Detail label="Confidence" value="High: SOC2 + questionnaire evidence matched" />
            <Detail label="Evidence" value="SOC2 says effective; questionnaire says MFA is planned." />
            <Detail label="Gap" value="Current administrative MFA enforcement is incomplete." />
            <Detail label="Recommendation" value="Request MFA enforcement proof and owner attestation." />
            <Detail label="Citations" value="SOC2 page 12, questionnaire row 4" />
          </div>
        </div>
      </div>
    </Section>
  );
}

function DeterministicScoring() {
  return (
    <Section>
      <SectionHeader eyebrow="Why deterministic scoring matters" title="AI reads the documents. Python decides the score." body="The model is used for understanding and planning. Risk scores are computed by explicit rules so security teams can audit every decision." />
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Comparison title="Traditional AI" icon={ShieldQuestion} items={["Hallucinates unsupported risk levels", "Changes answers across runs", "Hides why a score moved", "Hard to defend in an audit"]} muted />
        <Comparison title="Vendor Risk Agent" icon={ShieldCheck} items={["Evidence-backed findings", "Deterministic scoring logic", "Per-control citations", "Auditable confidence breakdown"]} />
      </div>
    </Section>
  );
}

function BuiltForEnterprise() {
  return (
    <Section>
      <SectionHeader eyebrow="Built for enterprise" title="One review surface for everyone in the approval chain." body="Security, compliance, procurement, legal, and vendor management teams see the same grounded decision record." />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {enterpriseAudiences.map((audience, index) => {
          const Icon = audience.icon;
          return (
            <motion.div key={audience.title} className="glass rounded-[1.75rem] p-5" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: index * 0.05 }}>
              <Icon className="h-5 w-5 text-stone-400" />
              <h3 className="mt-8 text-xl font-medium tracking-[-0.04em] text-stone-100">{audience.title}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-500">{audience.body}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function Architecture() {
  return (
    <Section>
      <SectionHeader eyebrow="Architecture" title="Built like a system, not a prompt." body="Each component has one job and every handoff preserves traceability from upload to report." />
      <div className="glass mt-14 rounded-[2.5rem] p-6">
        <div className="grid gap-4 md:grid-cols-4">
          {architecture.map((node, index) => (
            <motion.div key={node} className="relative rounded-3xl border border-white/10 bg-black/25 p-5" initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>
              <p className="text-xs text-stone-600">0{index + 1}</p>
              <h3 className="mt-6 text-xl font-medium tracking-[-0.04em] text-stone-100">{node}</h3>
              {index < architecture.length - 1 ? <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-stone-600" /> : null}
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function OpenSource() {
  const stack = ["Python", "FastAPI", "Next.js", "Vultr", "SOC2", "ISO27001", "GDPR"];
  return (
    <Section>
      <div className="glass overflow-hidden rounded-[2.5rem] p-8 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Open source</p>
            <h2 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.065em] text-stone-50 md:text-7xl">
              Inspect the agent. Run the demo. Read the rules.
            </h2>
            <a href={repoUrl} className="mt-8 inline-flex items-center rounded-full bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950">
              <GitBranch className="mr-2 h-4 w-4" /> Repository
            </a>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
            <Detail label="Repository" value="github.com/imranrkhan13/vendor" />
            <Detail label="License" value="Hackathon project repository" />
            <div className="mt-5 flex flex-wrap gap-2">
              {stack.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-stone-400">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section className="pb-10">
      <div className="py-24 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-stone-500">Final decision surface</p>
        <h2 className="mx-auto mt-6 max-w-5xl text-6xl font-semibold tracking-[-0.075em] text-stone-50 md:text-8xl">
          Know the risk before you trust the vendor.
        </h2>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="#demo" className="inline-flex items-center justify-center rounded-full bg-stone-100 px-6 py-3 text-sm font-medium text-stone-950">Try the demo</a>
          <a href={repoUrl} className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-stone-200">View the source</a>
        </div>
      </div>
      <footer className="border-t border-white/10 pt-8">
        <p className="text-center text-[12vw] font-semibold leading-none tracking-[-0.1em] text-white/[0.06]">
          Vendor Risk Assessment Agent
        </p>
      </footer>
    </Section>
  );
}

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`relative z-10 mx-auto w-full max-w-7xl px-5 py-24 md:px-8 ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <motion.div className="max-w-4xl" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-120px" }} variants={fadeUp} transition={{ duration: 0.7 }}>
      <Pill>{eyebrow}</Pill>
      <h2 className="mt-6 text-5xl font-semibold tracking-[-0.065em] text-stone-50 md:text-7xl">{title}</h2>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-stone-400">{body}</p>
    </motion.div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-stone-400 backdrop-blur-xl">
      <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
      {children}
    </span>
  );
}

function AnimatedMetric({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <div className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-stone-50">
        <motion.span animate={{ opacity: [0.55, 1, 0.75] }} transition={{ duration: 2, repeat: Infinity }}>{value}</motion.span>
        <span className="text-xl text-stone-500">{suffix}</span>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-600">{label}</p>
      <p className="mt-2 text-sm leading-6 text-stone-300">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-300">
      {label}
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-600">{label}</p>
      <p className="mt-2 text-2xl font-medium tracking-[-0.04em] text-stone-100">{value}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-xl text-stone-100">{value}</p>
    </div>
  );
}

function PreviewPanel({ title, value, icon }: { title: string; value: string; icon: LucideIcon }) {
  const Icon = icon;
  return (
    <motion.div className="rounded-[2rem] border border-white/10 bg-black/25 p-5" animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity }}>
      <Icon className="h-5 w-5 text-stone-500" />
      <p className="mt-10 text-sm text-stone-500">{title}</p>
      <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-stone-100">{value}</p>
    </motion.div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
      <h3 className="text-lg font-medium text-stone-100">{title}</h3>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 text-sm text-stone-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-stone-500" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function FrameworkBars() {
  const bars = [
    ["SOC2", "82%"],
    ["ISO", "64%"],
    ["GDPR", "51%"],
  ];
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
      <h3 className="text-lg font-medium text-stone-100">Framework Coverage</h3>
      <div className="mt-5 grid gap-4">
        {bars.map(([label, width]) => (
          <div key={label}>
            <div className="mb-2 flex justify-between text-sm text-stone-500"><span>{label}</span><span>{width}</span></div>
            <div className="h-1.5 rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-stone-200" initial={{ width: 0 }} whileInView={{ width }} viewport={{ once: true }} transition={{ duration: 1 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskTimeline() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
      <h3 className="text-lg font-medium text-stone-100">Risk Timeline</h3>
      <div className="mt-5 grid gap-3">
        {["Upload", "Gap detected", "Decision ready"].map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm text-stone-400">
            <TimerReset className="h-4 w-4 text-stone-600" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceViewerMini() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
      <h3 className="text-lg font-medium text-stone-100">Evidence Viewer</h3>
      <p className="mt-5 rounded-2xl bg-stone-100/[0.06] p-4 text-sm leading-6 text-stone-400">
        "No exceptions noted" · SOC2 page 12
      </p>
    </div>
  );
}

function SourceExcerpt({ title, body, citation }: { title: string; body: string; citation: string }) {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-5">
      <p className="text-sm font-medium text-stone-200">{title}</p>
      <p className="mt-3 text-sm leading-6 text-stone-400">{body}</p>
      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-stone-600">{citation}</p>
    </div>
  );
}

function Comparison({ title, icon, items, muted = false }: { title: string; icon: LucideIcon; items: string[]; muted?: boolean }) {
  const Icon = icon;
  return (
    <div className={`rounded-[2rem] border p-6 ${muted ? "border-white/10 bg-white/[0.025]" : "glass"}`}>
      <Icon className="h-6 w-6 text-stone-400" />
      <h3 className="mt-8 text-3xl font-medium tracking-[-0.05em] text-stone-100">{title}</h3>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 text-stone-400">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
