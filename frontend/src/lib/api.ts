// Strip any trailing slash(es) so `${API_BASE_URL}/api/...` never produces
// a double slash (e.g. NEXT_PUBLIC_API_URL set to ".../onrender.com/" would
// otherwise build ".../onrender.com//api/portfolio", which FastAPI 404s on).
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export type Profile = {
  name: string;
  headline: string;
  summary: string;
  location: string;
  total_experience_years: number;
  availability: string;
  website: string;
  linkedin: string;
  github: string;
};

export type Skills = Record<string, string[]>;

export type Position = {
  project: string;
  role: string;
  start_date: string;
  end_date: string;
  summary: string;
  responsibilities: string[];
  technologies: string[];
  achievements: string[];
};

export type Experience = {
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  location: string;
  summary: string;
  responsibilities: string[];
  technologies: string[];
  achievements: string[];
  // Present when one employer spans multiple distinct projects (e.g. an
  // agency tenure) — render as a grouped sub-list instead of a flat card.
  positions?: Position[];
};

export type Certification = {
  name: string;
  issuer: string;
  date: string;
  credential_url: string;
};

export type Project = {
  name: string;
  company: string;
  description: string;
  role: string;
  start_date: string;
  end_date: string;
  technologies: string[];
  responsibilities: string[];
  features: string[];
  achievements: string[];
  links: { live: string; github: string };
};

export type PortfolioData = {
  profile: Profile;
  skills: Skills;
  experience: Experience[];
  projects: Project[];
  target_roles: string[];
  certifications: Certification[];
};

export async function getPortfolio(): Promise<PortfolioData> {
  const res = await fetch(`${API_BASE_URL}/api/portfolio`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load portfolio data (${res.status})`);
  }
  return res.json();
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ToolCallLog = { name: string; arguments: Record<string, unknown>; result: string };

export type ChatResponse = { reply: string; tool_calls: ToolCallLog[] };

export async function postChat(
  message: string,
  history: ChatTurn[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`);
  }
  return res.json();
}

export type ContactPayload = {
  name?: string;
  email: string;
  subject: string;
  message: string;
};

export async function postContact(payload: ContactPayload): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Contact request failed (${res.status})`);
  }
}

// ---------------------------------------------------------------------------
// Admin: research recommendations + content draft review (private /admin page)
// ---------------------------------------------------------------------------

export type Platform = "linkedin" | "blog";
export type Style = "educational" | "technical" | "storytelling" | "conversational";

export type Recommendation = {
  id: string;
  topic: string;
  source: string;
  source_url: string;
  published_at: string;
  why_it_matters: string;
  personal_relevance: string;
  suggested_angle: string;
  recommended_platform: Platform;
  recommended_style: Style;
  confidence: number;
  supporting_facts: string[];
  status: string;
};

export type ResearchRun = {
  run_id: string;
  date: string;
  created_at: string;
  recommendations: Recommendation[];
};

export type ValidationIssue = { field: string; problem: string };
export type ValidationResult = { passed: boolean; issues: ValidationIssue[] };

export type DraftStatus =
  | "GENERATED"
  | "VALIDATED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "FINAL";

export type Draft = {
  id: string;
  recommendation_id: string;
  date: string;
  created_at: string;
  topic: string;
  platform: Platform;
  style: Style;
  content: string;
  supporting_facts: string[];
  validation: ValidationResult | null;
  status: DraftStatus;
  revision_feedback: string[];
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function getRecommendations(day?: string): Promise<ResearchRun | null> {
  const url = day
    ? `${API_BASE_URL}/api/research/recommendations?day=${day}`
    : `${API_BASE_URL}/api/research/recommendations`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  return jsonOrThrow<ResearchRun>(res);
}

export async function runResearchNow(topic?: string): Promise<ResearchRun> {
  const res = await fetch(`${API_BASE_URL}/api/research/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: topic || null }),
  });
  return jsonOrThrow<ResearchRun>(res);
}

export async function removeRecommendation(
  recommendationId: string,
  day: string
): Promise<ResearchRun> {
  const res = await fetch(
    `${API_BASE_URL}/api/research/recommendations/${recommendationId}?day=${day}`,
    { method: "DELETE" }
  );
  return jsonOrThrow<ResearchRun>(res);
}

export async function getDrafts(day: string): Promise<Draft[]> {
  const res = await fetch(`${API_BASE_URL}/api/content/drafts?day=${day}`, {
    cache: "no-store",
  });
  return jsonOrThrow<Draft[]>(res);
}

export async function generateDraft(
  recommendationId: string,
  date: string
): Promise<Draft> {
  const res = await fetch(`${API_BASE_URL}/api/content/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recommendation_id: recommendationId, date }),
  });
  return jsonOrThrow<Draft>(res);
}

export async function approveDraft(draftId: string, day: string): Promise<Draft> {
  const res = await fetch(
    `${API_BASE_URL}/api/content/${draftId}/approve?day=${day}`,
    { method: "POST" }
  );
  return jsonOrThrow<Draft>(res);
}

export async function rejectDraft(draftId: string, day: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/content/${draftId}/reject?day=${day}`,
    { method: "POST" }
  );
  await jsonOrThrow(res);
}

export async function reviseDraft(
  draftId: string,
  feedback: string,
  date: string
): Promise<Draft> {
  const res = await fetch(`${API_BASE_URL}/api/content/${draftId}/revise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback, date }),
  });
  return jsonOrThrow<Draft>(res);
}

export async function markPosted(draftId: string, day: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/content/${draftId}/mark-posted?day=${day}`,
    { method: "POST" }
  );
  await jsonOrThrow(res);
}
