export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
