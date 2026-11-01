import type {
  Certification,
  Experience,
  Project,
  Skills,
  SystemDesign,
} from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend & APIs",
  mobile: "Mobile",
  data: "Data",
  cloud_devops: "Cloud, DevOps & tooling",
  ai: "AI & LLM",
  system_design: "System design",
};

// Skills whose evidence is a credential rather than a job, matched by issuer.
const CERT_ISSUER_FOR: Record<string, string> = { GCP: "Google Cloud" };

function label(key: string) {
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, " ");
}

function Chip({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        strong
          ? "rounded-md border border-[var(--accent-via)]/40 bg-[var(--accent-via)]/10 px-2 py-0.5 text-xs text-[var(--foreground)]"
          : "rounded-md border border-[var(--border)] bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]"
      }
    >
      {children}
    </span>
  );
}

// "Used at NerdyLabs · TCS" — derived from experience and project data, so a
// core skill only claims what the rest of the portfolio already shows.
function evidenceFor(
  skill: string,
  experience: Experience[],
  projects: Project[],
  certifications: Certification[]
): string {
  const jobs = experience
    .filter(
      (e) =>
        e.technologies.includes(skill) ||
        (e.positions ?? []).some((p) => p.technologies.includes(skill))
    )
    .map((e) => e.short_name ?? e.company);
  if (jobs.length) return jobs.join(" · ");
  const side = projects
    .filter((p) => p.company === "Personal Project" && p.technologies.includes(skill))
    .map((p) => p.name);
  if (side.length) return side.join(" · ");
  const issuer = CERT_ISSUER_FOR[skill];
  const certs = issuer ? certifications.filter((c) => c.issuer === issuer).length : 0;
  return certs ? `${certs} ${issuer} certifications` : "";
}

export default function SkillsSection({
  skills,
  systemDesign,
  experience,
  projects,
  certifications,
}: {
  skills: Skills;
  systemDesign?: SystemDesign;
  experience: Experience[];
  projects: Project[];
  certifications: Certification[];
}) {
  const core = skills.key_skills ?? [];
  // system_design chips stay in the data for the chat; the block below
  // already presents them in more depth.
  const hidden = ["key_skills", "recent_skills", ...(systemDesign ? ["system_design"] : [])];
  const categories = Object.entries(skills).filter(
    ([key, values]) => values.length > 0 && !hidden.includes(key)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Core stack with where each skill was used */}
      {core.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
            Core stack
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {core.map((s) => {
              const evidence = evidenceFor(s, experience, projects, certifications);
              return (
                <div key={s} className="card flex flex-col gap-1 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{s}</span>
                  {evidence && (
                    <span className="text-[11px] leading-4 text-[var(--muted)]">{evidence}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbox by category */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categories.map(([key, values]) => (
          <div key={key} className="card flex flex-col gap-2.5 rounded-xl p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-via)]">
              {label(key)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {values.map((v) => (
                <Chip key={v} strong={core.includes(v)}>
                  {v}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cloud & system design */}
      {systemDesign && systemDesign.focus_areas.length > 0 && (
        <div className="card flex flex-col gap-5 rounded-2xl p-6">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-[var(--foreground)]">Cloud &amp; System Design</p>
            <p className="text-sm text-[var(--muted)]">{systemDesign.summary}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {systemDesign.focus_areas.map((area) => (
              <div
                key={area.title}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">{area.title}</p>
                <p className="text-xs leading-5 text-[var(--muted)]">{area.summary}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  {area.tools.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
                {area.applied_in && (
                  <p className="text-[11px] leading-4 text-cyan-300/90">
                    <span className="font-semibold">Applied · </span>
                    {area.applied_in}
                  </p>
                )}
                {area.link && (
                  <a
                    href={area.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[var(--foreground)] underline underline-offset-4 hover:text-[var(--accent-via)]"
                  >
                    Read ↗
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
            {(
              [
                ["GCP", systemDesign.gcp_toolset],
                ["Low-level design", systemDesign.lld],
                ["Case studies", systemDesign.case_studies],
              ] as const
            )
              .filter(([, items]) => items.length > 0)
              .map(([name, items]) => (
                <div key={name} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                  <span className="pt-0.5 text-xs font-semibold text-[var(--foreground)]">{name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((i) => (
                      <Chip key={i}>{i}</Chip>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
