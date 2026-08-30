import Chat from "@/components/Chat";
import CodingAvatar from "@/components/CodingAvatar";
import Nav from "@/components/Nav";
import RoleRotator from "@/components/RoleRotator";
import {
  getPortfolio,
  type Certification,
  type Experience,
  type Project,
  type PortfolioData,
} from "@/lib/api";

function formatRange(start: string, end: string) {
  if (!start && !end) return "";
  return `${start || "?"} – ${end || "Present"}`;
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-via)]">
        {eyebrow}
      </span>
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">
      {children}
    </span>
  );
}

function GradientPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-3 py-1 text-xs font-medium text-white shadow shadow-[var(--accent-via)]/30">
      {children}
    </span>
  );
}

function groupByIssuer(certs: Certification[]): [string, Certification[]][] {
  const groups = new Map<string, Certification[]>();
  for (const cert of certs) {
    if (!groups.has(cert.issuer)) groups.set(cert.issuer, []);
    groups.get(cert.issuer)!.push(cert);
  }
  return Array.from(groups.entries());
}

function ExperienceCard({ exp }: { exp: Experience }) {
  return (
    <div className="card flex flex-col gap-3 rounded-2xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-[var(--foreground)]">
          {exp.positions ? exp.company : `${exp.role} · ${exp.company}`}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatRange(exp.start_date, exp.end_date)}
        </p>
      </div>
      {exp.summary && <p className="text-sm text-[var(--muted)]">{exp.summary}</p>}
      {exp.responsibilities.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-[var(--muted)]">
          {exp.responsibilities.map((r, j) => (
            <li key={j}>{r}</li>
          ))}
        </ul>
      )}
      {exp.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {exp.technologies.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      )}
      {exp.achievements.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-[var(--accent-via)]">
          {exp.achievements.map((a, j) => (
            <li key={j}>{a}</li>
          ))}
        </ul>
      )}

      {exp.positions && exp.positions.length > 0 && (
        <div className="mt-2 flex flex-col gap-4 border-l-2 border-[var(--border)] pl-5">
          {exp.positions.map((pos, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--foreground)]">
                  {pos.project}{" "}
                  <span className="text-[var(--muted)]">({pos.role})</span>
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatRange(pos.start_date, pos.end_date)}
                </p>
              </div>
              {pos.summary && (
                <p className="text-sm text-[var(--muted)]">{pos.summary}</p>
              )}
              {pos.responsibilities.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-[var(--muted)]">
                  {pos.responsibilities.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              )}
              {pos.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pos.technologies.map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="card flex flex-col gap-2 rounded-2xl p-6">
      <p className="font-semibold text-[var(--foreground)]">{project.name}</p>
      {project.company && project.company !== "Personal Project" && (
        <p className="text-xs text-[var(--accent-via)]">{project.company}</p>
      )}
      <p className="text-sm text-[var(--muted)]">{project.description}</p>
      {project.technologies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {project.technologies.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioContent({ data }: { data: PortfolioData }) {
  const { profile, skills, experience, projects, target_roles, certifications } =
    data;
  const keySkills = skills.key_skills ?? [];
  const recentSkills = skills.recent_skills ?? [];
  const skillCategories = Object.entries(skills).filter(
    ([key, values]) =>
      values.length > 0 && key !== "key_skills" && key !== "recent_skills"
  );
  const professionalProjects = projects.filter(
    (p) => p.company !== "Personal Project"
  );
  const personalProjects = projects.filter(
    (p) => p.company === "Personal Project"
  );
  const latestRole = experience[0];
  const year = new Date().getFullYear();

  return (
    <>
      <Nav initials={initialsOf(profile.name)} />

      {/* Hero */}
      <section
        id="home"
        className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden px-6 pb-20 pt-20 text-center sm:pt-28"
      >
        <div className="glow-orb -left-20 top-10 h-72 w-72 bg-[var(--accent-from)]" />
        <div className="glow-orb -right-16 top-40 h-72 w-72 bg-[var(--accent-to)]" />

        <CodingAvatar className="h-36 w-36 drop-shadow-lg sm:h-40 sm:w-40" />

        <p className="text-sm text-[var(--muted)]">Hello! I&apos;m</p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="gradient-text">{profile.name}</span>
        </h1>

        <p className="min-h-8 text-lg text-[var(--muted)] sm:text-xl">
          A <RoleRotator roles={target_roles} /> by trade
        </p>

        <p className="max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base">
          {profile.summary}
        </p>

        {latestRole && (
          <p className="text-sm text-[var(--muted)]">
            Currently building at{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {latestRole.company}
            </span>
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#chat"
            className="rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--accent-via)]/20 transition-transform hover:scale-105"
          >
            Ask my AI assistant
          </a>
          {profile.github && (
            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-white/30"
            >
              GitHub
            </a>
          )}
          {profile.linkedin && (
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-white/30"
            >
              LinkedIn
            </a>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--muted)]">
          {profile.location && <span>{profile.location}</span>}
          {profile.total_experience_years > 0 && (
            <>
              <span className="opacity-40">•</span>
              <span>{profile.total_experience_years}+ years experience</span>
            </>
          )}
        </div>
      </section>

      {/* Experience */}
      {experience.length > 0 && (
        <section
          id="experience"
          className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-20"
        >
          <SectionHeading eyebrow="Career" title="Work Experience" />
          <div className="flex flex-col gap-5">
            {experience.map((exp, i) => (
              <ExperienceCard key={i} exp={exp} />
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {skillCategories.length > 0 && (
        <section
          id="skills"
          className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-20"
        >
          <SectionHeading eyebrow="Toolbox" title="Skills" />

          {(keySkills.length > 0 || recentSkills.length > 0) && (
            <div className="card flex flex-col gap-4 rounded-2xl p-6">
              {keySkills.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
                    Key
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {keySkills.map((v) => (
                      <Pill key={v}>{v}</Pill>
                    ))}
                  </div>
                </div>
              )}
              {recentSkills.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
                    Recent
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSkills.map((v) => (
                      <GradientPill key={v}>{v}</GradientPill>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card flex flex-col gap-4 rounded-2xl p-6">
            {skillCategories.map(([category, values]) => (
              <div
                key={category}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--accent-via)]">
                  {category}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {values.map((v) => (
                    <Pill key={v}>{v}</Pill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <section
          id="certifications"
          className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-20"
        >
          <SectionHeading eyebrow="Credentials" title="Certifications" />
          <div className="flex flex-col gap-5">
            {groupByIssuer(certifications).map(([issuer, certs]) => (
              <div key={issuer} className="card rounded-2xl p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-via)]">
                  {issuer}
                </p>
                <div className="flex flex-wrap gap-2">
                  {certs.map((c, i) =>
                    c.credential_url ? (
                      <a
                        key={i}
                        href={c.credential_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:border-[var(--accent-via)] hover:text-[var(--accent-via)]"
                      >
                        {c.name}
                      </a>
                    ) : (
                      <span
                        key={i}
                        className="rounded-full border border-[var(--border)] bg-white/5 px-3 py-1.5 text-xs text-[var(--muted)]"
                      >
                        {c.name}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      {professionalProjects.length > 0 && (
        <section
          id="projects"
          className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-20"
        >
          <SectionHeading eyebrow="Portfolio" title="Projects" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {professionalProjects.map((p, i) => (
              <ProjectCard key={i} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Personal Projects */}
      {personalProjects.length > 0 && (
        <section
          id="personal-projects"
          className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12"
        >
          <SectionHeading eyebrow="Side builds" title="Personal Projects" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {personalProjects.map((p, i) => (
              <ProjectCard key={i} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Chat */}
      <section
        id="chat"
        className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-20"
      >
        <SectionHeading eyebrow="MCP-powered" title="Ask about this candidate" />
        <Chat />
      </section>

      {/* Contact / Footer */}
      <footer
        id="contact"
        className="border-t border-[var(--border)] px-6 py-16 text-center"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <h2 className="text-2xl font-bold">Let&apos;s connect</h2>
          {target_roles.length > 0 && (
            <p className="text-sm text-[var(--muted)]">
              Open to roles as {target_roles.join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--foreground)] underline underline-offset-4 hover:text-[var(--accent-via)]"
              >
                Website
              </a>
            )}
            {profile.linkedin && (
              <a
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--foreground)] underline underline-offset-4 hover:text-[var(--accent-via)]"
              >
                LinkedIn
              </a>
            )}
            {profile.github && (
              <a
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--foreground)] underline underline-offset-4 hover:text-[var(--accent-via)]"
              >
                GitHub
              </a>
            )}
          </div>
          <p className="mt-6 text-xs text-[var(--muted)]">
            © {year} {profile.name}. Built with Next.js, FastAPI and MCP.
          </p>
        </div>
      </footer>
    </>
  );
}

export default async function Home() {
  let data: PortfolioData | null = null;
  let loadError: string | null = null;

  try {
    data = await getPortfolio();
  } catch {
    loadError =
      "Couldn't load portfolio data from the backend. Start the FastAPI service (uvicorn api.chat_server:app) and refresh.";
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--background)]">
      {loadError ? (
        <p className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-red-300">
          {loadError}
        </p>
      ) : (
        data && <PortfolioContent data={data} />
      )}
    </div>
  );
}
