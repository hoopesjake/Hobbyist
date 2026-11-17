"use client";
import { BackLink } from "@/components/layout/back-link";
export default function Error({reset}:{reset:()=>void}){return <section className="media-empty" role="alert"><h2>Game catalog unavailable</h2><button className="account-button" onClick={reset}>Try again</button><p><BackLink href="/games/discover">Back to discover</BackLink></p></section>;}
