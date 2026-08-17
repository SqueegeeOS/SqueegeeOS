"use client";

import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { craftEyebrow, craftHeading } from "@/lib/craft/tokens";

const STORAGE_KEY = "homeatlas:atlas-operator-chat:v1";
const QUICK_PROMPTS = [
  "What should I focus on today?",
  "Which members need attention?",
  "What is ready to bill this month?",
  "Give me a clear business snapshot.",
] as const;

function toolLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("en-US"));
}

function readStoredMessages(): UIMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]).slice(-40) : [];
  } catch {
    return [];
  }
}

function AtlasToolPart({ part }: { part: ReturnType<typeof toolPart> }) {
  if (!part) return null;
  const label = toolLabel(
    part.type === "dynamic-tool" ? part.toolName : part.type.slice(5),
  );
  const completed = part.state === "output-available";
  const failed = part.state === "output-error" || part.state === "output-denied";

  return (
    <div
      className={`mt-3 rounded-2xl border px-4 py-3 text-xs ${
        failed
          ? "border-red-400/25 bg-red-400/[0.06] text-red-200"
          : completed
            ? "border-emerald-400/20 bg-emerald-400/[0.055] text-emerald-100"
            : "border-accent/20 bg-accent/[0.045] text-accent"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            failed ? "bg-red-300" : completed ? "bg-emerald-300" : "animate-pulse bg-accent"
          }`}
        />
        <span className="font-medium">{label}</span>
      </div>
      {completed && part.output && typeof part.output === "object" && "reviewUrl" in part.output ? (
        <Link
          href={String((part.output as { reviewUrl: unknown }).reviewUrl)}
          className="mt-3 inline-flex rounded-full border border-emerald-300/25 px-3 py-1.5 text-[11px] text-emerald-100 transition hover:bg-emerald-300/10"
        >
          Open human review
        </Link>
      ) : null}
    </div>
  );
}

function toolPart(part: UIMessage["parts"][number]) {
  return isToolUIPart(part) ? part : null;
}

function AtlasMessage({ message }: { message: UIMessage }) {
  const fromAtlas = message.role === "assistant";
  return (
    <article className={`flex gap-3 ${fromAtlas ? "justify-start" : "justify-end"}`}>
      {fromAtlas ? (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.055]">
          <AtlasMark size={17} />
        </span>
      ) : null}
      <div
        className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 text-sm leading-relaxed sm:max-w-[80%] ${
          fromAtlas
            ? "border border-border/75 bg-background/65 text-foreground"
            : "bg-accent text-background"
        }`}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                {part.text}
              </p>
            );
          }
          const resolvedToolPart = toolPart(part);
          if (resolvedToolPart) {
            return (
              <AtlasToolPart
                key={resolvedToolPart.toolCallId}
                part={resolvedToolPart}
              />
            );
          }
          return null;
        })}
      </div>
    </article>
  );
}

function AtlasOperatorWorkspace() {
  const [input, setInput] = useState("");
  const historyReadyRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    stop,
    clearError,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/admin/atlas" }),
    throttle: 40,
  });

  useEffect(() => {
    setMessages(readStoredMessages());
    historyReadyRef.current = true;
  }, [setMessages]);

  useEffect(() => {
    if (!historyReadyRef.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    void sendMessage({ text });
    setInput("");
  };

  const runPrompt = (prompt: string) => {
    if (busy) return;
    clearError();
    void sendMessage({ text: prompt });
  };

  return (
    <AmbientStage className="min-h-[100svh] px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-6xl">
        <HqFounderNav />

        <MotionReveal className="mb-8 mt-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className={craftEyebrow}>Private operating intelligence</p>
              <h1 className={`${craftHeading} mt-3 text-4xl sm:text-5xl`}>Atlas</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
                Ask HomeAtlas what is true, what needs attention, or where to go next.
                Atlas can investigate and prepare work; customer messages and payments
                remain behind a human-controlled final step.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-emerald-200">
                Live business tools
              </span>
              <span className="rounded-full border border-accent/20 bg-accent/[0.05] px-3 py-2 text-accent">
                Human approval boundary
              </span>
            </div>
          </div>
        </MotionReveal>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <GlassCard tone="elevated" padding="none" motion="rise" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-accent/[0.055]">
                  <AtlasMark size={19} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Operator channel</p>
                  <p className="text-[11px] text-muted">Grounded in HomeAtlas data</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  window.localStorage.removeItem(STORAGE_KEY);
                }}
                disabled={busy || messages.length === 0}
                className="rounded-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted transition hover:text-foreground disabled:opacity-40"
              >
                New thread
              </button>
            </div>

            <div className="h-[min(58svh,38rem)] overflow-y-auto px-4 py-5 sm:px-6">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <AtlasMark size={36} />
                  <h2 className="mt-5 font-serif text-2xl font-light text-foreground">
                    What do you need to know?
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                    Atlas reads the operating system before answering. It will say when
                    the evidence is missing instead of filling in the blanks.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((message) => (
                    <AtlasMessage key={message.id} message={message} />
                  ))}
                  {busy ? (
                    <div className="flex items-center gap-2 pl-11 text-xs text-muted">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                      Atlas is reading HomeAtlas…
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {error ? (
              <div className="mx-4 mb-3 rounded-2xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3 text-xs text-red-200 sm:mx-6">
                {error.message || "Atlas could not complete that request."}
              </div>
            ) : null}

            <form onSubmit={submit} className="border-t border-border/60 p-4 sm:p-5">
              <div className="flex items-end gap-3 rounded-[1.35rem] border border-border bg-background/65 p-2 focus-within:border-accent/35">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  maxLength={2_000}
                  placeholder="Ask Atlas about members, billing, requests, or the next move…"
                  className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted/70"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="min-h-11 rounded-full border border-border px-4 text-xs text-muted transition hover:text-foreground"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="min-h-11 rounded-full bg-accent px-5 text-xs font-semibold text-background transition hover:opacity-95 disabled:opacity-40"
                  >
                    Ask Atlas
                  </button>
                )}
              </div>
              <p className="mt-2 px-2 text-[10px] leading-relaxed text-muted/75">
                Conversation history stays on this device. Do not paste passwords, card
                numbers, API keys, or PINs.
              </p>
            </form>
          </GlassCard>

          <aside className="space-y-4">
            <GlassCard tone="subtle" padding="md" motion="rise">
              <p className={craftEyebrow}>Start here</p>
              <div className="mt-4 space-y-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => runPrompt(prompt)}
                    disabled={busy}
                    className="w-full rounded-2xl border border-border/70 bg-background/45 px-3 py-3 text-left text-xs leading-relaxed text-muted transition hover:border-accent/25 hover:text-foreground disabled:opacity-45"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </GlassCard>

            <GlassCard tone="subtle" padding="md" motion="rise">
              <p className={craftEyebrow}>Safety membrane</p>
              <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
                <li>Reads live HomeAtlas operating facts.</li>
                <li>Prepares billing reviews without charging.</li>
                <li>Drafts communication without sending.</li>
                <li>Refuses to guess when records conflict.</li>
              </ul>
            </GlassCard>
          </aside>
        </div>
      </div>
    </AmbientStage>
  );
}

export function AtlasOperatorPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  if (!unlocked) return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  return <AtlasOperatorWorkspace />;
}
