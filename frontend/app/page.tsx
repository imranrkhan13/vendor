import LandingPage from "../components/landing-page";

const FEATURES = [
  { icon: "🧭", title: "Plans frameworks", copy: "SOC2, ISO 27001 & GDPR" },
  { icon: "🔍", title: "Two-pass retrieval", copy: "Evidence + cross-reference" },
  { icon: "📊", title: "Deterministic scores", copy: "Auditable, never LLM-guessed" },
] as const;

const STEPS = [
  "Plan applicable frameworks & control categories",
  "Retrieve SOC2 control descriptions, results & opinion",
  "Cross-reference questionnaire answers against evidence",
  "Query breach history and apply deterministic scoring",
] as const;

export default function Home() {
  const [brief, setBrief] = useState<RiskBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setBrief(null);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await submitAssessment(formData);
      setBrief(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">
          <span className="dot" /> Powered by Vultr Serverless Inference
        </div>
        <h1>
          Vendor risk briefs,<br />
          <span className="gradient-text">agentically generated.</span>
        </h1>
        <p className="lede">
          Upload a SOC2 Type II report, a completed security questionnaire, and optional breach
          context. The agent plans frameworks, retrieves evidence in two passes, calls a
          breach-history tool, and returns a deterministic risk brief with per-control citations.
        </p>
        <div className="feature-row">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.title}>
              <span className="feature-icon" aria-hidden>{feature.icon}</span>
              <div>
                <strong>{feature.title}</strong>
                <span>{feature.copy}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid">
        <form className="card form" onSubmit={onSubmit}>
          <h2>Run assessment</h2>
          <p className="form-hint">Deterministic scoring — the LLM never assigns risk scores.</p>
          <div className="field">
            <label htmlFor="vendor_name">Vendor name</label>
            <input id="vendor_name" name="vendor_name" type="text" placeholder="Acme Cloud" required />
          </div>
          <div className="field">
            <label htmlFor="soc2_report">SOC2 Type II report (PDF)</label>
            <input id="soc2_report" name="soc2_report" type="file" accept="application/pdf" required />
          </div>
          <div className="field">
            <label htmlFor="questionnaire">Security questionnaire (JSON or CSV)</label>
            <input id="questionnaire" name="questionnaire" type="file" accept=".json,.csv" required />
          </div>
          <div className="field">
            <label htmlFor="breach_history">Optional breach history document</label>
            <input id="breach_history" name="breach_history" type="file" accept=".txt,.md,.csv,.json" />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Assessing vendor..." : "Generate risk brief"}
          </button>
          {error ? <p className="error">{error}</p> : null}
          <p>
            Demo tip: include one questionnaire answer such as "MFA is planned" while the SOC2 report
            says access controls are effective to trigger a deterministic discrepancy flag.
          </p>
        </form>

        <div className="stack">
          {brief ? <RiskBriefView brief={brief} /> : <EmptyState />}
        </div>
      </section>

      <footer className="footer">
        <span>Vendor Risk Assessment Agent</span>
        <span>Built for the Vultr track · deterministic scoring engine</span>
      </footer>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Structured risk brief</div>
        <h2>How the agent works</h2>
      </div>
      <p>
        Submit the form to generate a brief with selected frameworks, an overall risk score,
        per-category findings, citations, breach conflicts, confidence scores, and follow-up
        questions.
      </p>
      <ol className="steps">
        {STEPS.map((step, index) => (
          <li key={step}>
            <span className="step-index">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RiskBriefView({ brief }: { brief: RiskBrief }) {
  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">{brief.vendor_name}</div>
        <h2>Risk brief</h2>
      </div>

      <div className="score-row">
        <Metric label="Risk score" value={`${brief.overall_risk_score}/100`} />
        <Metric label="Risk level" value={brief.overall_risk_level.toUpperCase()} />
        <Metric label="Confidence" value={`${Math.round(brief.confidence_score * 100)}%`} />
      </div>

      <div>
        <h3>Plan</h3>
        <div className="pill-row">
          {brief.plan.frameworks.map((framework) => (
            <span className="pill" key={framework}>{framework}</span>
          ))}
        </div>
        <p>{brief.plan.rationale}</p>
      </div>

      <div>
        <h3>Workflow trace</h3>
        {brief.workflow_trace.map((step) => (
          <p key={step}>- {step}</p>
        ))}
      </div>

      {brief.auditor_opinion ? (
        <div>
          <h3>Auditor opinion excerpt</h3>
          <p>{brief.auditor_opinion}</p>
        </div>
      ) : null}

      <div>
        <h3>Category breakdown</h3>
        {brief.categories.map((finding) => (
          <div className="category" key={finding.category}>
            <h3>
              {finding.category.replaceAll("_", " ")}{" "}
              <span className={`status-${finding.status}`}>({finding.status})</span>
            </h3>
            <p>Score {finding.score}/100 · confidence {Math.round(finding.confidence * 100)}%</p>
            <p>{finding.rationale}</p>
            {finding.gaps.map((gap) => (
              <p className="error" key={gap}>Gap: {gap}</p>
            ))}
            {finding.citations.slice(0, 3).map((citation, index) => (
              <div className="citation" key={`${citation.source}-${citation.location}-${index}`}>
                <strong>{citation.source} · {citation.location}</strong>
                <br />
                {citation.quote}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div>
        <h3>Recommended follow-up questions</h3>
        {brief.follow_up_questions.map((question) => (
          <p key={question}>- {question}</p>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
