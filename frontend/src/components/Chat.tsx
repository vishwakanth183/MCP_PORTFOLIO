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
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Ask about this candidate
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Answers are grounded in the candidate&apos;s portfolio data via MCP
          tools — not invented.
        </p>
      </div>

      <div className="flex min-h-[280px] max-h-[420px] flex-col gap-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Try asking:
            </p>
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="w-fit rounded-full border border-zinc-200 px-3 py-1.5 text-left text-xs text-zinc-700 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
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
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                : "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
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
          <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Thinking…
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about skills, projects, experience…"
          className="flex-1 rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-opacity disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </form>
    </div>
  );
}
