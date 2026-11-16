"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="en"><body style={{ background: "#111211", color: "#f1f0eb", fontFamily: "sans-serif", padding: 32 }}><h1>We could not load Hobbyist</h1><p>Please check your connection. If this continues, check the Supabase environment variables and database migration.</p><button onClick={reset}>Try again</button></body></html>;
}
