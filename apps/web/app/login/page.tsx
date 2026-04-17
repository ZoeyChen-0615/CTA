"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setStatus("error");
      setError(err.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-lg">
        <Link href="/" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">
          ← Back
        </Link>
        <h1 className="mb-2 text-2xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-gray-400">
          We&apos;ll email you a one-time link. No password needed.
        </p>
        {status === "sent" ? (
          <div className="rounded-lg bg-emerald-900/40 p-4 text-sm text-emerald-200">
            ✓ Check <strong>{email}</strong> for a sign-in link.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-white"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-white px-4 py-3 font-semibold text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <div className="rounded-lg bg-red-900/40 p-3 text-sm text-red-200">{error}</div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
