"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, LucideIcon, ShieldCheck, Sparkles } from "lucide-react";

import { RiskBrief } from "../../../lib/api";

type AssessmentRecord = {
  id: string;
  createdAt: string;
  brief: RiskBrief;
};

const sharedReportPrefix = "vendor-risk-shared-report:";

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [record, setRecord] = useState<AssessmentRecord | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(`${sharedReportPrefix}${params.token}`);
    if (raw) {
      setRecord(JSON.parse(raw) as AssessmentRecord);
    }
  }, [params.token]);

  if (!record) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-5 py-16 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-blue-600" />
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Report link not available</h1>
          <p className="mt-3 text-slate-600">
            This secure demo link is stored in the browser that generated it. Open the report from
            the same workspace or generate a new share link.
          </p>
        </div>
      </main>
    );
  }

  const brief = record.brief;
  const confidence = Math.round(brief.confidence_score * 100);
  const recommendation =
    brief.overall_risk_score > 65
      ? "Escalate before approval"
      : brief.flagged_gaps.length
        ? "Approve after targeted follow-up"
        : "Proceed with standard vendor controls";

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-10 text-slate-950 print:bg-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                Vendor Risk Assessment Agent
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">Executive Risk Report</h1>
            </div>
          </div>
          <button className="btn-primary print:hidden" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Print report
          </button>
        </header>

        <section className="mt-6 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-600 p-8 text-white shadow-xl shadow-blue-600/20">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Vendor</p>
          <h2 className="mt-3 text-5xl font-semibold tracking-[-0.06em]">{brief.vendor_name}</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-blue-50">{recommendation}.</p>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            <ReportMetric label="Overall Risk" value={`${brief.overall_risk_score}/100`} />
            <ReportMetric label="Confidence" value={`${confidence}%`} />
            <ReportMetric label="Critical Findings" value={String(brief.flagged_gaps.length)} />
            <ReportMetric label="Frameworks" value={brief.plan.frameworks.join(", ")} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <ReportCard title="Executive Summary" icon={Sparkles}>
            <p>
              {brief.vendor_name} is assessed as {brief.overall_risk_level} risk with {confidence}%
              confidence. The recommended decision is: {recommendation.toLowerCase()}.
            </p>
          </ReportCard>
          <ReportCard title="Recommendations" icon={FileText}>
            <ul className="grid gap-2">
              {brief.follow_up_questions.map((question) => (
                <li key={question}>- {question}</li>
              ))}
            </ul>
          </ReportCard>
        </div>

        <ReportCard title="Risk Matrix and Evidence Appendix" icon={ShieldCheck} className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {brief.categories.map((finding) => (
              <div key={finding.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold capitalize">{finding.category.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm text-slate-600">Score {finding.score}/100 · {finding.status}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{finding.rationale}</p>
                {finding.citations.slice(0, 2).map((citation, index) => (
                  <p key={`${citation.source}-${index}`} className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">
                    {citation.source} · {citation.location}: {citation.quote}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </ReportCard>
      </div>
    </main>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ReportCard({
  children,
  className = "",
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className={`rounded-[2rem] border border-slate-200 bg-white p-6 leading-7 text-slate-700 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}
