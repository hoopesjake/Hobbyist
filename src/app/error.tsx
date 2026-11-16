"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="account-page"><h1>We could not load your space</h1><p>Please check your connection. If this continues, check the Supabase configuration and profile migration.</p><button className="account-button" onClick={reset}>Try again</button></div>;
}
