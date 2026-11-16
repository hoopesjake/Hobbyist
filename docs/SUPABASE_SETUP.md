# Hobbyist Phase 2A setup

## Environment

The local `.env.local` was empty when this phase was implemented. No database connection, account creation, email delivery, or live RLS enforcement has been verified. No migration was applied and nothing was pushed to GitHub.

Copy the variable names from `.env.example` into `.env.local` and supply your project's URL and **publishable** key from Supabase Project Settings > API. A legacy anon key is also accepted as `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally and your exact HTTPS application origin in production (no trailing slash). Never use a secret/service-role key in any `NEXT_PUBLIC_` variable. This application does not need one.

Restart `npm run dev` after editing environment variables. Set the variables before `npm run build` for a production deployment; public variables are compiled into the application.

## Apply the additive migration

Open Supabase SQL Editor in the intended project, review and execute `supabase/migrations/202611160001_profiles.sql` **once**. It creates profiles, private preferences, RLS policies, column privileges, and an auth-user signup trigger; existing accounts receive private profiles too. It does not drop tables or overwrite existing data. It expects these new table/function names to be unused; review any existing schema before applying. The transaction rolls back if there is a conflict or error.

Alternatively, with Supabase CLI installed and this project linked, use your normal migration workflow (`supabase init` if needed, `supabase link --project-ref YOUR_PROJECT_REF`, review `supabase db push --dry-run`, then `supabase db push`). Do not run both methods against the same migration without reconciling CLI migration history.

Profiles start with a generated unique username and display name `Hobbyist`. Change both at `/profile`. New usernames are normalized to lowercase and must be 3-30 ASCII letters, numbers, or underscores. The database enforces format and uniqueness; the auth trigger never trusts user metadata for ownership or privileges.

## Authentication dashboard settings

1. Enable the Email provider and **Confirm email** under Authentication > Providers. Set a minimum password length of at least 12 to match signup validation.
2. Under Authentication > URL Configuration, set Site URL to your app origin. Allow `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/callback?next=/auth/update-password`, and equivalent exact production URLs. Do not use broad production redirect wildcards.
3. Configure email templates. The built-in PKCE flow uses the standard `{{ .ConfirmationURL }}` links and `/auth/callback` code exchange. These links require the initiating browser's PKCE cookie. For confirmation/reset links that also work in a different browser, use the token-hash templates below with the supplied `/auth/confirm` handler (recommended). Replace the origin with your Site URL or use `{{ .SiteURL }}`. Only the handler's fixed signup/recovery destinations are accepted.
4. Configure production SMTP and review Supabase's email quotas and auth rate limits. Email delivery requires a working project email configuration.

Confirm signup email link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
```

Reset password email link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

Expired or reused links show an error and let users request another password reset. For an expired signup confirmation, use Supabase's resend confirmation capability/dashboard for now; a separate resend UI is not included.

## Routes and security

- `/`: existing dashboard, now authenticated and personalized.
- `/auth/sign-up`, `/auth/sign-in`, `/auth/reset`, `/auth/update-password`: account flows; password changes require a server-verified user.
- `/profile`: owner-only basic profile editing and sign-out.
- `/u/[username]`: public profile foundation. Private profiles return 404 to visitors; owners can preview their own private profile.
- Existing hobby pages, navigation, search, responsive layouts, and demonstration activity content remain. Activity, favorites, notifications, and friends are still placeholders.

Browser and server Supabase clients use `@supabase/ssr`. `src/proxy.ts` refreshes auth cookies using `getClaims()`, carries updated cookies into the request and response, and sets no-store on configured application responses. Server pages/actions independently validate the user with `getUser()`; authorization does not depend on proxy. No service-role bypass is used. Server Actions provide Next.js same-origin submission protection. Keep personalized responses out of shared CDN caches.

Profiles contain public-facing identity fields only, with private visibility by default. Anonymous SQL access cannot read account UUID or visibility columns. Email/password remain in Supabase Auth. Private customization settings live in `user_preferences` behind separate owner-only RLS, and are never selected by public profile routes. Owners can update only editable columns, not ownership or creation dates. There are no client profile insert/delete grants; profile creation is handled by a security-definer trigger with a fixed empty search path. Avatars and banners are nullable references only; no upload/storage policies are introduced yet. Private asset storage will need its own policies before uploads are added.

Preferences use a bounded JSON object to support future versioned keys such as `dashboard.widgets`, `favorites.topFourByCategory`, `mosaic`, `theme`, and `contentVisibility`. No customization controls or integrations are implemented. Add validation for each preference when its feature is introduced; the SQL currently enforces object shape/size and ownership.

## Validation and manual checklist

`npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. Production-server HTTP smoke checks passed for all three public account forms, signed-out dashboard/profile/password-change protection, existing hobby/community pages, invalid callback links, and missing/invalid routes. Next.js may stream redirects and not-found boundaries after sending HTTP 200; browser-level navigation still needs manual verification. Builds required permission to spawn Next.js workers in the restricted sandbox. No authenticated browser flow was exercised without credentials.

`supabase/tests/profiles_rls.sql` is an executable rollback-only authorization test for a local/disposable Supabase database. Run it as postgres through SQL Editor or `psql -v ON_ERROR_STOP=1 -f supabase/tests/profiles_rls.sql`. It creates two temporary auth users, tests anonymous visibility, owner private reads, owner updates, cross-user denial (including public profiles), unique usernames, immutable creation dates, and private preferences. All fixtures are rolled back. This test has **not** been executed here: there is no configured database or local Supabase/Postgres executable.

After configuring Supabase:

1. Create an account; confirm the email; verify a private profile row and preferences row were created.
2. Sign in; verify your name/initial in the sidebar, top bar, and dashboard. Refresh and restart the browser to check persistent sessions.
3. Edit username/display name/bio/visibility. Refresh to verify persistence; try a duplicate username and invalid input.
4. Open `/u/your_username` in a signed-out browser: private gives 404; public shows only intended fields. Switch back to private and repeat.
5. Use two accounts and direct Supabase calls to attempt editing another user's profile or reading their preferences; verify denial. Run the SQL test above.
6. Request a password reset, follow the email, save a new password, sign out, and sign in with the new password. Try an expired/reused link and mismatched passwords.
7. Sign out; verify `/` and `/profile` require sign-in, including direct requests and browser back navigation. Check desktop/mobile navigation and search.

Official references: [SSR clients/session refresh](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [password authentication](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Recover a missing profile

If an authenticated account has no matching `profiles` row (for example after deleting the row in Table Editor), the app now displays a recovery screen with a working sign-out button. It never fabricates a profile or relaxes RLS. A real query failure is still treated as an error; the terminal logs its database code without account details.

If the migration already exists, run `supabase/repairs/restore_missing_profiles.sql` in Supabase SQL Editor. It inserts only missing profiles and preferences for existing auth users. Existing profile data, accounts, passwords, and RLS policies are preserved. Do not rerun the original create-table migration. Refresh the app after the repair. If the account itself was deleted from Authentication > Users, create a new account instead; this script does not recreate deleted auth users.
