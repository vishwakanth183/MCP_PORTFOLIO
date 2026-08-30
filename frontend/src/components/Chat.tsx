"use client";

import { useState } from "react";
import { postChat, type ChatTurn, type ToolCallLog } from "@/lib/api";

type DisplayMessage = ChatTurn & { toolCalls?: ToolCallLog[] };

const SAMPLE_QUESTIONS = [
  "What frontend frameworks does this candidate know?",
  "Tell me about the Merchant Portal project.",
  "Why would this candidate be a good fit for a React role?",
  "Has this candidate worked with Kubernetes in production?",
];

export default function Chat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history: ChatTurn[] = messages.map(({ role, content }) => ({
      role,
      content,
    }));

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await postChat(trimmed, history);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.reply,
          toolCalls: response.tool_calls,
        },
      ]);
    } catch {
      setError(
        "Couldn't reach the chat service. Is the FastAPI backend (api/chat_server.py) running?"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-col rounded-2xl">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <p className="text-xs text-[var(--muted)]">
          Answers are grounded in the candidate&apos;s portfolio data via MCP
          tools — not invented.
        </p>
      </div>

      <div className="flex min-h-[200px] max-h-[320px] flex-col gap-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--muted)]">Try asking:</p>
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="w-fit rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent-via)] hover:text-[var(--foreground)]"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-4 py-2 text-sm text-white"
                : "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-white/5 px-4 py-2 text-sm text-[var(--foreground)]"
            }
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <details className="mt-2 text-xs opacity-70">
                <summary className="cursor-pointer">
                  MCP tools used: {m.toolCalls.map((t) => t.name).join(", ")}
                </summary>
                <ul className="mt-1 space-y-1">
                  {m.toolCalls.map((t, j) => (
                    <li key={j}>
                      <code>
                        {t.name}({JSON.stringify(t.arguments)})
                      </code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-white/5 px-4 py-2 text-sm text-[var(--muted)]">
            Thinking…
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about skills, projects, experience…"
          className="flex-1 rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-via)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-gradient-to-r from-[var(--accent-from)] via-[var(--accent-via)] to-[var(--accent-to)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
