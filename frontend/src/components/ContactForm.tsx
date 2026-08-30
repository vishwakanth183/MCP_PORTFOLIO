"use client";

import { useState } from "react";
import { postContact } from "@/lib/api";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorText(null);

    try {
      await postContact({ name, email, subject, message });
      setStatus("sent");
      setSubject("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorText(
        err instanceof Error ? err.message : "Couldn't send your message."
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="card mx-auto mt-4 max-w-lg rounded-2xl p-6 text-center">
        <p className="text-sm text-[var(--foreground)]">
          Thanks — your message is on its way. I&apos;ll get back to you soon.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 text-xs text-[var(--accent-via)] underline underline-offset-2"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card mx-auto mt-4 flex w-full max-w-lg flex-col gap-3 rounded-2xl p-6 text-left"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
        />
      </div>
      <input
        required
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
      />
      <textarea
        required
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What would you like to say?"
        className="resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
      />

      {status === "error" && (
        <p className="text-xs text-red-400">{errorText}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="self-center rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {status === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
