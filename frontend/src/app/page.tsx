import Chat from "@/components/Chat";
import Nav from "@/components/Nav";
import RoleRotator from "@/components/RoleRotator";
import { getPortfolio, type PortfolioData } from "@/lib/api";

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

function PortfolioContent({ data }: { data: PortfolioData }) {
  const { profile, skills, experience, projects, target_roles } = data;
  const skillCategories = Object.entries(skills).filter(
    ([, values]) => values.length > 0
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

        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] text-2xl font-bold text-white shadow-lg shadow-[var(--accent-via)]/30">
          {initialsOf(profile.name)}
        </div>

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
              <div key={i} className="card flex flex-col gap-2 rounded-2xl p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[var(--foreground)]">
                    {exp.role} <span className="text-[var(--muted)]">·</span>{" "}
                    {exp.company}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatRange(exp.start_date, exp.end_date)}
                  </p>
                </div>
                {exp.summary && (
                  <p className="text-sm text-[var(--muted)]">{exp.summary}</p>
                )}
                {exp.responsibilities.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-[var(--muted)]">
                    {exp.responsibilities.map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                )}
                {exp.technologies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exp.technologies.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                )}
              </div>
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

      {/* Projects */}
      {projects.length > 0 && (
        <section
          id="projects"
          className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-20"
        >
          <SectionHeading eyebrow="Portfolio" title="Projects" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {projects.map((p, i) => (
              <div
                key={i}
                className="card flex flex-col gap-2 rounded-2xl p-6"
              >
                <p className="font-semibold text-[var(--foreground)]">
                  {p.name}
                </p>
                {p.company && (
                  <p className="text-xs text-[var(--accent-via)]">
                    {p.company}
                  </p>
                )}
                <p className="text-sm text-[var(--muted)]">{p.description}</p>
                {p.technologies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.technologies.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                )}
              </div>
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
