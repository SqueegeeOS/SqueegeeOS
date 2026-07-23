"use client";

import { useState } from "react";
import { craftInput, craftLabel, craftPrimaryButton } from "@/lib/craft/tokens";

const NEUTRAL_MESSAGE =
  "If access is available for that address, a secure sign-in link will arrive shortly.";

export function HqLoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await fetch("/auth/hq/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath }),
      });
    } finally {
      setMessage(NEUTRAL_MESSAGE);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="hq-email" className={craftLabel}>
          Headquarters email
        </label>
        <input
          id="hq-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={craftInput}
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || email.trim().length === 0}
        className={`w-full ${craftPrimaryButton}`}
      >
        {submitting ? "Requesting link…" : "Email secure sign-in link"}
      </button>
      {message ? (
        <p role="status" className="text-sm leading-relaxed text-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
