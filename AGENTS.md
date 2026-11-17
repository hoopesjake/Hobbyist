<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Interface conventions

- Use the shared `NavigationTabs` component for horizontal page navigation so the current destination stays highlighted, including query-based tabs such as Watchlist.
- Use the shared `BackLink` component for back navigation. Keep its arrow centered beside the label across detail, error, and not-found pages.
- Favor clear controls and concise labels over instructional copy explaining routine interactions or automatic tracking behavior.
