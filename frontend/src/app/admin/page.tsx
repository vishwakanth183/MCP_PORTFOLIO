"use client";

import { useEffect, useState } from "react";
import {
  approveDraft,
  generateDraft,
  getDrafts,
  getRecommendations,
  markPosted,
  rejectDraft,
  removeRecommendation,
  reviseDraft,
  runResearchNow,
  type Draft,
  type Recommendation,
  type ResearchRun,
} from "@/lib/api";

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--muted)]">
      {pct}% confidence
    </span>
  );
}

function ValidationSummary({ draft }: { draft: Draft }) {
  if (!draft.validation) return null;
  const { passed, issues } = draft.validation;
  return (
    <div
      className={
        passed
          ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
          : "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
      }
    >
      <p className="font-medium">
        {passed ? "Validation passed" : "Validation failed — do not approve as-is"}
      </p>
      {issues.length > 0 && (
        <ul className="mt-1 list-disc pl-4">
          {issues.map((issue, i) => (
            <li key={i}>
              <span className="font-mono">{issue.field}</span>: {issue.problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftPanel({
  draft,
  day,
  onChange,
  onCleared,
}: {
  draft: Draft;
  day: string;
  onChange: (d: Draft) => void;
  onCleared: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guard(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs uppercase tracking-wide text-[var(--accent-via)]">
          {draft.status}
        </span>
        <span className="text-xs text-[var(--muted)]">
          {draft.content.trim().split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      <ValidationSummary draft={draft} />

      <div className="thin-scrollbar max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-sm text-[var(--foreground)]">
        {draft.content}
      </div>

      {draft.revision_feedback.length > 0 && (
        <details className="text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">
            Revision history ({draft.revision_feedback.length})
          </summary>
          <ul className="mt-1 list-disc pl-4">
            {draft.revision_feedback.map((fb, i) => (
              <li key={i}>{fb}</li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {draft.status === "APPROVED" ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--muted)]">
            Copy the text above and post it yourself, then confirm below —
            nothing is posted automatically.
          </p>
          <button
            disabled={busy !== null}
            onClick={() =>
              guard("posted", async () => {
                await markPosted(draft.id, day);
                onCleared();
              })
            }
            className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {busy === "posted" ? "Marking…" : "Mark Posted"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy !== null}
              onClick={() =>
                guard("approve", async () => {
                  const updated = await approveDraft(draft.id, day);
                  onChange(updated);
                })
              }
              className="rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() =>
                guard("reject", async () => {
                  await rejectDraft(draft.id, day);
                  onCleared();
                })
              }
              className="rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-medium text-red-300 disabled:opacity-40"
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!feedback.trim()) return;
              guard("revise", async () => {
                const updated = await reviseDraft(draft.id, feedback.trim(), day);
                onChange(updated);
                setFeedback("");
              });
            }}
            className="flex items-center gap-2"
          >
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Revision feedback, e.g. 'make it shorter and punchier'"
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
            />
            <button
              type="submit"
              disabled={busy !== null || !feedback.trim()}
              className="shrink-0 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--foreground)] disabled:opacity-40"
            >
              {busy === "revise" ? "Revising…" : "Request Revision"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  rec,
  day,
  draft,
  onDraftChange,
  onDraftCleared,
  onRemove,
}: {
  rec: Recommendation;
  day: string;
  draft: Draft | null;
  onDraftChange: (d: Draft) => void;
  onDraftCleared: () => void;
  onRemove: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const d = await generateDraft(rec.id, day);
      onDraftChange(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      await removeRecommendation(rec.id, day);
      onRemove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove this recommendation.");
      setRemoving(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-[var(--foreground)]">{rec.topic}</p>
        <div className="flex items-center gap-2">
          <ConfidenceBadge value={rec.confidence} />
          <button
            onClick={handleRemove}
            disabled={removing}
            title="Remove this recommendation"
            className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--muted)] transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Source:{" "}
        <a
          href={rec.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-[var(--accent-via)]"
        >
          {rec.source}
        </a>
        {rec.published_at && ` · ${rec.published_at}`}
      </p>

      <p className="text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">Why it matters: </span>
        {rec.why_it_matters}
      </p>
      <p className="text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">Personal relevance: </span>
        {rec.personal_relevance}
      </p>
      <p className="text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">Suggested angle: </span>
        {rec.suggested_angle}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          {rec.recommended_platform}
        </span>
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          {rec.recommended_style}
        </span>
      </div>

      {rec.supporting_facts.length > 0 && (
        <details className="text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">
            Supporting facts ({rec.supporting_facts.length})
          </summary>
          <ul className="mt-1 list-disc pl-4">
            {rec.supporting_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!draft && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-fit rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {generating ? "Generating…" : "Generate Draft"}
        </button>
      )}

      {draft && (
        <DraftPanel
          draft={draft}
          day={day}
          onChange={onDraftChange}
          onCleared={onDraftCleared}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [runningResearch, setRunningResearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDraftsFor(day: string) {
    try {
      const list = await getDrafts(day);
      const byRec: Record<string, Draft> = {};
      for (const d of list) byRec[d.recommendation_id] = d;
      setDrafts(byRec);
    } catch {
      // Non-fatal — recommendations still render without drafts loaded.
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getRecommendations();
      setRun(data);
      if (data) await loadDraftsFor(data.date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Standard fetch-on-mount: `load` sets loading/error/run/drafts state
    // as its async body progresses, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    load();
  }, []);

  const [topic, setTopic] = useState("");

  async function handleRunResearch(topicQuery?: string) {
    setRunningResearch(true);
    setError(null);
    try {
      const data = await runResearchNow(topicQuery);
      setRun(data);
      await loadDraftsFor(data.date);
      if (topicQuery) setTopic("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research run failed.");
    } finally {
      setRunningResearch(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-via)]">
            Private · Content Pipeline
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Research &amp; Content Review</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Nothing here publishes automatically — approve a draft, paste it
            in yourself, then mark it posted.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunResearch()}
            disabled={runningResearch}
            className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-white/30 disabled:opacity-40"
          >
            {runningResearch ? "Researching…" : "Profile Based Research"}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!topic.trim() || runningResearch) return;
              handleRunResearch(topic.trim());
            }}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Search a specific topic, e.g. 'kubernetes'"
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
            />
            <button
              type="submit"
              disabled={runningResearch || !topic.trim()}
              className="shrink-0 rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {runningResearch ? "Searching…" : "Search Topic"}
            </button>
          </form>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {!loading && !run && (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--muted)]">
            No research run found for today yet. Run it now, or wait for the
            daily scheduled run.
          </p>
        </div>
      )}

      {run && (
        <div className="flex flex-col gap-6">
          <p className="text-xs text-[var(--muted)]">
            Run {run.run_id} · {run.date}
          </p>
          {run.recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              day={run.date}
              draft={drafts[rec.id] ?? null}
              onDraftChange={(d) =>
                setDrafts((prev) => ({ ...prev, [rec.id]: d }))
              }
              onDraftCleared={() =>
                setDrafts((prev) => {
                  const next = { ...prev };
                  delete next[rec.id];
                  return next;
                })
              }
              onRemove={() => {
                setRun((prev) =>
                  prev
                    ? {
                        ...prev,
                        recommendations: prev.recommendations.filter(
                          (r) => r.id !== rec.id
                        ),
                      }
                    : prev
                );
                setDrafts((prev) => {
                  const next = { ...prev };
                  delete next[rec.id];
                  return next;
                });
              }}
            />
          ))}
          {run.recommendations.length === 0 && (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-sm text-[var(--muted)]">
                All recommendations removed. Run research again for more.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
