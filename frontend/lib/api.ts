export type Citation = {
  source: string;
  location: string;
  quote: string;
};

export type CategoryFinding = {
  category: string;
  status: string;
  score: number;
  confidence: number;
  rationale: string;
  citations: Citation[];
  gaps: string[];
};

export type RiskBrief = {
  vendor_name: string;
  overall_risk_score: number;
  overall_risk_level: string;
  confidence_score: number;
  confidence_breakdown: {
    score: number;
    direct_evidence_controls: number;
    partial_evidence_controls: number;
    no_evidence_controls: number;
    total_controls: number;
    formula: string;
    notes: string[];
  };
  auditor_opinion: string | null;
  workflow_trace: string[];
  categories: CategoryFinding[];
  flagged_gaps: Array<{
    category: string;
    gap: string;
    score: number | null;
    citations: Citation[];
  }>;
  follow_up_questions: string[];
  breach_history: Array<{
    vendor_name: string;
    year: number;
    summary: string;
    categories: string[];
    severity: string;
    source: string;
  }>;
  plan: {
    frameworks: string[];
    categories: string[];
    rationale: string;
  };
};

export type TraceEvent = {
  step: string;
  message: string;
  frameworks?: string[];
  categories?: string[];
  category?: string;
  score?: number;
  brief?: RiskBrief;
};

export type DocumentChatResponse = {
  answer: string;
  provider: string;
  citations: Citation[];
};

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
  }

  return "http://localhost:8000";
}

export async function submitAssessment(formData: FormData): Promise<RiskBrief> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/assess`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Assessment failed");
  }

  return response.json();
}

export async function streamAssessmentTrace(
  formData: FormData,
  onEvent: (event: TraceEvent) => void
): Promise<RiskBrief> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/trace`, {
    method: "POST",
    body: formData
  });

  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Trace failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let brief: RiskBrief | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventText of events) {
      const line = eventText.split("\n").find((item) => item.startsWith("data:"));
      if (!line) {
        continue;
      }

      const event = JSON.parse(line.replace(/^data:\s*/, "")) as TraceEvent;
      onEvent(event);
      if (event.brief) {
        brief = event.brief;
      }
      if (event.step === "error") {
        throw new Error(event.message);
      }
    }
  }

  if (!brief) {
    throw new Error("Trace completed without a risk brief");
  }

  return brief;
}

export async function chatWithDocuments(input: {
  question: string;
  citations: Citation[];
  vendor_name?: string;
}): Promise<DocumentChatResponse> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Document chat failed");
  }

  return response.json();
}
