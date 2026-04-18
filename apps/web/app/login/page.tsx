"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Magic link flow is fragile: email preview scanners (Gmail, Outlook, iOS Mail)
// fetch every URL in the email to build a preview card and consume the single-use
// token before the real user clicks. We use the 6-digit code from the same email
// instead — a form submission scanner can't trigger.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setStatus("idle");
    if (err) {
      setError(err.message);
    } else {
      setStep("code");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setStatus("idle");
    if (err) {
      setError(err.message);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-lg">
        <Link href="/" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">
          ← Back
        </Link>
        <h1 className="mb-2 text-2xl font-semibold">Sign in</h1>

        {step === "email" ? (
          <>
            <p className="mb-6 text-sm text-gray-400">
              We&apos;ll email you a 6-digit code. No password needed.
            </p>
            <form onSubmit={sendCode} className="flex flex-col gap-3">
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
                disabled={status === "working"}
                className="rounded-lg bg-white px-4 py-3 font-semibold text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
              >
                {status === "working" ? "Sending…" : "Send code"}
              </button>
              {error && (
                <div className="rounded-lg bg-red-900/40 p-3 text-sm text-red-200">{error}</div>
              )}
            </form>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-400">
              Enter the 6-digit code we sent to <strong>{email}</strong>.
            </p>
            <p className="mb-6 text-xs text-gray-500">
              (Check the email — the code is right above or below the link.)
            </p>
            <form onSubmit={verifyCode} className="flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white outline-none focus:border-white"
              />
              <button
                type="submit"
                disabled={status === "working" || code.length < 6}
                className="rounded-lg bg-white px-4 py-3 font-semibold text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
              >
                {status === "working" ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Use a different email
              </button>
              {error && (
                <div className="rounded-lg bg-red-900/40 p-3 text-sm text-red-200">{error}</div>
              )}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
