"use client";
import { BackLink } from "@/components/layout/back-link";
export default function Error({ reset }: { reset: () => void }) {
  return <section className="page-content library-panel" role="alert"><h1>Your calendar could not be loaded</h1><p>Your activities may be temporarily unavailable.</p><button className="account-button" onClick={reset}>Try again</button><p><BackLink href="/">Back to home</BackLink></p></section>;
}
