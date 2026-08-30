"use client";

import { useRef } from "react";
import type { Certification } from "@/lib/api";

const HIGHLIGHTED_ISSUERS = ["Anthropic", "Google Cloud"];

function isHighlightedIssuer(issuer: string) {
  return HIGHLIGHTED_ISSUERS.includes(issuer) || issuer.startsWith("Microsoft");
}

// Highlighted issuers first (stable order preserved within each bucket) so
// the most relevant certifications are what a visitor scrolls past first.
function orderCertifications(certs: Certification[]) {
  const highlighted = certs.filter((c) => isHighlightedIssuer(c.issuer));
  const rest = certs.filter((c) => !isHighlightedIssuer(c.issuer));
  return [...highlighted, ...rest];
}

function CertCard({
  cert,
  highlighted,
}: {
  cert: Certification;
  highlighted: boolean;
}) {
  const className = highlighted
    ? "flex w-56 shrink-0 snap-start flex-col gap-1 rounded-2xl bg-gradient-to-br from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] p-4 shadow-lg shadow-[var(--accent-via)]/30 transition-transform hover:scale-[1.03]"
    : "flex w-44 shrink-0 snap-start flex-col gap-1 rounded-2xl border border-[var(--border)] bg-white/5 p-4 transition-colors hover:border-[var(--accent-via)]";

  const content = (
    <>
      <p
        className={
          highlighted
            ? "text-[10px] font-semibold uppercase tracking-wide text-white/80"
            : "text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-via)]"
        }
      >
        {cert.issuer}
      </p>
      <p
        className={
          highlighted
            ? "text-sm font-semibold leading-snug text-white"
            : "text-sm leading-snug text-[var(--foreground)]"
        }
      >
        {cert.name}
      </p>
    </>
  );

  if (cert.credential_url) {
    return (
      <a
        href={cert.credential_url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Scroll certifications ${direction}`}
      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white/5 text-[var(--foreground)] transition-colors hover:border-[var(--accent-via)] hover:text-[var(--accent-via)] sm:flex"
    >
      {direction === "left" ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M12.5 4 6 10l6.5 6 1.4-1.4L8.8 10l4.1-4.6z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M7.5 4 14 10l-6.5 6-1.4-1.4L11.2 10 7.1 5.4z" />
        </svg>
      )}
    </button>
  );
}

export default function CertificationsScroller({
  certifications,
}: {
  certifications: Certification[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(amount: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollLeft + amount, behavior: "smooth" });
  }

  return (
    <div className="flex items-center gap-2">
      <ArrowButton direction="left" onClick={() => scrollBy(-320)} />
      <div
        ref={scrollerRef}
        className="thin-scrollbar flex snap-x scroll-smooth gap-3 overflow-x-auto pb-3"
      >
        {orderCertifications(certifications).map((c, i) => (
          <CertCard key={i} cert={c} highlighted={isHighlightedIssuer(c.issuer)} />
        ))}
      </div>
      <ArrowButton direction="right" onClick={() => scrollBy(320)} />
    </div>
  );
}
