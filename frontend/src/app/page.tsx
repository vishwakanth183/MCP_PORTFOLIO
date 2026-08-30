import CertificationsScroller from "@/components/CertificationsScroller";
import Chat from "@/components/Chat";
import CodingAvatar from "@/components/CodingAvatar";
import ContactForm from "@/components/ContactForm";
import Nav from "@/components/Nav";
import RoleRotator from "@/components/RoleRotator";
import {
  getPortfolio,
  type Experience,
  type Project,
  type PortfolioData,
} from "@/lib/api";

function formatRange(start: string, end: string) {
  if (!start && !end) return "";
  return `${start || "?"} – ${end || "Present"}`;
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


function ExperienceCard({ exp }: { exp: Experience }) {
  const positions = exp.positions ?? [];
  // A single position just re-states the company-level tenure with one
  // project — showing the aggregate summary/tech above AND the position's
  // own copy below is pure duplication. Only show the outer aggregate block
  // when there's more than one project to aggregate.
  const showAggregate = positions.length !== 1;

  return (
    <div className="card flex flex-col gap-3 rounded-2xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-[var(--foreground)]">
          {positions.length > 0 ? exp.company : `${exp.role} · ${exp.company}`}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatRange(exp.start_date, exp.end_date)}
        </p>
      </div>

      {showAggregate && (
        <>
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
            <div className="flex flex-wrap gap-1.5">
              {exp.technologies.map((t) => (
                <Pill key={t}>{t}</Pill>
              ))}
            </div>
          )}
        </>
      )}
      {exp.achievements.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-[var(--accent-via)]">
          {exp.achievements.map((a, j) => (
            <li key={j}>{a}</li>
          ))}
        </ul>
      )}

      {positions.length > 0 && (
        <div
          className={
            showAggregate
              ? "mt-2 flex flex-col gap-4 border-l-2 border-[var(--border)] pl-5"
              : "flex flex-col gap-4"
          }
        >
          {positions.map((pos, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--foreground)]">
                  {pos.project}
                  <span className="text-[var(--muted)]"> · {pos.role}</span>
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

function ProjectCard({
  project,
  variant = "professional",
}: {
  project: Project;
  variant?: "professional" | "personal";
}) {
  const isPersonal = variant === "personal";

  return (
    <div
      className={
        isPersonal
          ? "flex flex-col gap-2 rounded-2xl border border-cyan-400/25 bg-[#0b1f22] p-6"
          : "card flex flex-col gap-2 rounded-2xl p-6"
      }
    >
      <p className="font-semibold text-[var(--foreground)]">{project.name}</p>
      {project.company && project.company !== "Personal Project" && (
        <p className="text-xs text-[var(--accent-via)]">{project.company}</p>
      )}
      <p className="text-sm text-[var(--muted)]">{project.description}</p>
      {project.technologies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {project.technologies.map((t) =>
            isPersonal ? (
              <span
                key={t}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300"
              >
                {t}
              </span>
            ) : (
              <Pill key={t}>{t}</Pill>
            )
          )}
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
      <Nav initials="VK" />

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

      <div className="mx-auto grid max-w-6xl gap-x-10 px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col">
      {/* Experience */}
      {experience.length > 0 && (
        <section id="experience" className="flex flex-col gap-8 py-16">
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
        <section id="skills" className="flex flex-col gap-8 py-16">
          <SectionHeading eyebrow="Toolbox" title="Skills" />

          {(keySkills.length > 0 || recentSkills.length > 0) && (
            <div className="card flex flex-col gap-4 rounded-2xl p-6">
              {keySkills.length > 0 && (
                <div className="grid grid-cols-[5rem_1fr] gap-3 sm:grid-cols-[6rem_1fr]">
                  <span className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
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
                <div className="grid grid-cols-[5rem_1fr] gap-3 sm:grid-cols-[6rem_1fr]">
                  <span className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
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
                className="grid grid-cols-[5rem_1fr] gap-3 sm:grid-cols-[6rem_1fr]"
              >
                <span className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-via)]">
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
        <section id="certifications" className="flex flex-col gap-8 py-16">
          <SectionHeading eyebrow="Credentials" title="Certifications" />
          <p className="-mt-4 text-xs text-[var(--muted)]">
            Anthropic, Google Cloud and Microsoft credentials highlighted —
            tap any card to open its verification link.
          </p>
          <CertificationsScroller certifications={certifications} />
        </section>
      )}

      {/* Projects */}
      {professionalProjects.length > 0 && (
        <section id="projects" className="flex flex-col gap-8 py-16">
          <SectionHeading eyebrow="Professional Work" title="Projects" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {professionalProjects.map((p, i) => (
              <ProjectCard key={i} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Personal Projects */}
      {personalProjects.length > 0 && (
        <section id="personal-projects" className="flex flex-col gap-8 py-16">
          <SectionHeading eyebrow="Side builds" title="Personal Projects" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {personalProjects.map((p, i) => (
              <ProjectCard key={i} project={p} variant="personal" />
            ))}
          </div>
        </section>
      )}
      </div>

      {/* Chat — sticky alongside the content on large screens. Capped to
          the viewport height as a safety net for short viewports; the
          scrollbar is hidden here (wheel/trackpad still work) rather than
          styled, since this sticky container doesn't respect
          ::-webkit-scrollbar-button the way the main page scrollbar does.
          The visible, arrow-free scroll affordance is the chat message
          list itself (Chat.tsx), which is what actually grows over time —
          this outer cap should rarely engage at all with tighter padding. */}
      <aside
        id="chat"
        className="thin-scrollbar min-w-0 overscroll-contain py-8 lg:sticky lg:top-24 lg:h-fit lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:py-8"
      >
        <div className="flex flex-col gap-4">
          <SectionHeading
            eyebrow="MCP-powered"
            title="Ask about this candidate"
          />
          <Chat />
        </div>
      </aside>
      </div>

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

          <ContactForm />

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
