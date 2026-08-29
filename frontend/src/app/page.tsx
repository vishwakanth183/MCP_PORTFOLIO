import Chat from "@/components/Chat";
import { getPortfolio, type PortfolioData } from "@/lib/api";

function formatRange(start: string, end: string) {
  if (!start && !end) return "";
  return `${start || "?"} – ${end || "Present"}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function PortfolioContent({ data }: { data: PortfolioData }) {
  const { profile, skills, experience, projects } = data;
  const skillCategories = Object.entries(skills).filter(
    ([, values]) => values.length > 0
  );

  return (
    <>
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {profile.name}
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          {profile.headline}
        </p>
        <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {profile.summary}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {profile.location && <span>{profile.location}</span>}
          {profile.total_experience_years > 0 && (
            <span>{profile.total_experience_years}+ years experience</span>
          )}
          {profile.website && (
            <a
              className="underline underline-offset-2"
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Website
            </a>
          )}
          {profile.linkedin && (
            <a
              className="underline underline-offset-2"
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          )}
          {profile.github && (
            <a
              className="underline underline-offset-2"
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          )}
        </div>
      </header>

      {skillCategories.length > 0 && (
        <Section title="Skills">
          <div className="flex flex-col gap-2">
            {skillCategories.map(([category, values]) => (
              <div key={category} className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="Experience">
          <div className="flex flex-col gap-5">
            {experience.map((exp, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {exp.role} · {exp.company}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatRange(exp.start_date, exp.end_date)}
                  </p>
                </div>
                {exp.summary && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {exp.summary}
                  </p>
                )}
                {exp.responsibilities.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                    {exp.responsibilities.map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Projects">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.map((p, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {p.name}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {p.description}
                </p>
                {p.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.technologies.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
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
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="grid w-full max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-10">
          {loadError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {loadError}
            </p>
          ) : (
            data && <PortfolioContent data={data} />
          )}
        </div>
        <div className="lg:sticky lg:top-16 lg:self-start">
          <Chat />
        </div>
      </main>
    </div>
  );
}
