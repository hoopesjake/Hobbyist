"use client";
import { BackLink } from "@/components/layout/back-link";
export default function Error({ reset }: { reset: () => void }) { return <section className="media-empty" role="alert"><h2>Your list could not be loaded</h2><button className="account-button" onClick={reset}>Try again</button><p><BackLink href="/lists">Back to lists</BackLink></p></section>; }
