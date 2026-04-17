import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="text-6xl">🚌</div>
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        CTA Transit Tracker
      </h1>
      <p className="max-w-lg text-lg text-gray-300">
        Live Chicago bus and train positions. Pick the routes you ride, watch the vehicles
        move in real time on a map.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 transition hover:bg-gray-100"
      >
        Sign in to get started →
      </Link>
      <div className="text-xs text-gray-500">
        8 train lines · 20 bus routes · updates every 20 seconds
      </div>
    </main>
  );
}
