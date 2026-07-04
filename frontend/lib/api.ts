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

export async function submitAssessment(formData: FormData): Promise<RiskBrief> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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
