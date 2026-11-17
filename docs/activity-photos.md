# Activity photos and media-page controls

## What changed

Movie, show, episode and game detail pages now use `MediaActivityPanel`, a client component with real on-page actions. **Plan to watch**, **Log a viewing**, and their gaming equivalents open the shared activity editor directly, with the selected provider identity/title/artwork. **View full history** expands all loaded history on that media page instead of navigating through calendar query parameters. Individual sessions open the same editor, with a separate View in Calendar link. Library-card calendar links remain available.

This addresses the reported buttons doing nothing without requiring users to navigate away from their movie/show/game to create or inspect a log. Browser tests click the actual handlers across all three media types and verify older entries appear beyond the five-session preview.

Actual linked movie/TV/game logs have **Choose photos** and **Take photo** controls. On supported phones, the latter invokes the native rear-camera capture picker (`capture="environment"`). Other devices may show their normal file picker. The app does not keep a camera stream open or ask for camera access until the user chooses the control. A physical-device test is still required; a headless browser cannot verify a real camera permission/capture flow.

Up to six photos belong to each activity. The browser prepares JPEG copies with a longest edge of 2048 pixels, keeping original files unchanged and excluding source EXIF metadata from the stored copy. Browser-supported source images up to 20 MB are accepted; stored images are limited to 8 MB. Unsupported images, including HEIC on browsers unable to decode it, get a recoverable error. There is no additional image conversion dependency.

Photo previews, selection, removal and viewing are available in the shared editor. Saved thumbnails also appear in Calendar agenda/day activity cards and on media-page history cards. Opening a thumbnail shows the private original through an authenticated endpoint. Public reviews never receive these photos.

## Photo captions

Photos have an optional caption field beneath the preview. Enter or edit up to 500 characters and select **Save activity**. Captions remain private, display beneath photos in calendar and media-page history, and can be cleared without removing the photo.

Apply `supabase/migrations/202611170010_photo_captions.sql` after 009. It adds an empty default caption to existing photos, grants owner-scoped caption writes under existing RLS, and does not modify image files. This migration has not been applied to hosted Supabase automatically.

## Storage and authorization

Apply **`supabase/migrations/202611170009_activity_photos.sql` after 001-008** to a separate Supabase development project first. It creates the private `activity-photos` bucket, `activity_photos` metadata, owner-scoped Storage policies, and a durable `activity_photo_cleanup` queue. It does not alter credentials or other buckets. Restrictive bucket-specific policies prevent older unrelated permissive Storage policies from making these photos public.

No hosted migration or bucket has been created automatically. If 001-008 are already present, apply only 009 through the existing SQL editor/migration workflow. The migration creates and configures the bucket, so no separate manual public bucket is needed. Deploy the matching application code after testing the migration. See Supabase's [private bucket documentation](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage access policies](https://supabase.com/docs/guides/storage/security/access-control).

API endpoints:

- `GET /api/activity-photos?entry=<uuid>`: owner-only metadata listing.
- `POST /api/activity-photos`: bounded multipart upload to an owned, saved actual media activity. File signature, size, IDs and same-origin requests are validated; original filenames are not stored.
- `GET /api/activity-photos/<uuid>`: rechecks the owner, then returns the private photo with `private, no-store`, `nosniff`, and a sandbox content policy. There are no permanent public or signed bearer URLs.
- `DELETE /api/activity-photos/<uuid>`: removes owner metadata and drains the physical Storage cleanup queue.

Each upload uses a stable UUID and reserves one metadata row. Retries reuse the same reservation/object instead of duplicating photos. The activity is saved first; if a photo fails, the editor explicitly reports that the activity was saved and keeps remaining local selections for retry. A transactional RPC wrapper returns the exact saved version. Retrying Save Activity uses that version rather than inserting another session or overwriting a newer edit from another tab. Successful uploads disappear from the pending queue independently.

Deleting an activity cascades metadata deletion and queues Storage object cleanup. Storage and PostgreSQL cannot share a transaction, so failed physical deletions remain durably queued and are retried on the owner's next photo operation. Activity deletion also attempts immediate cleanup. An operator should periodically drain abandoned-account cleanup rows through the Storage API using the project's normal administrative process; this implementation does not introduce a service-role key or scheduled administrative job. Never delete Storage object metadata directly in production SQL.

## Validation and remaining live checks

- Existing calendar/media unit tests continue to run.
- API tests cover owner-only reads, no-store responses, repeat uploads, failed-upload retries, wrong content, oversized requests, signed-out requests, cross-origin writes and metadata deletion.
- The isolated PostgreSQL runner applies all nine migrations and checks photo ownership, cross-owner read/write isolation, reserved Storage paths, limits, unlink constraints, cascading metadata deletion and durable cleanup. Minimal Storage tables in this runner exercise policies; they are not the Supabase Storage HTTP service.
- Browser tests use the actual interactive media panel, editor, image preparation and gallery with isolated upload/action fixtures. They cover movie/TV/game buttons, expanded old history, photo selection, upload failure/retry without duplicate sessions, reload and removal. Existing desktop/mobile/calendar/rating flows remain in the same suite.
- Production build, lint and TypeScript checks are required.

After applying 009 in development, test one real upload, reopen it from both Calendar and the media page, sign out and confirm the photo cannot be fetched, then test with a second account. Test real camera capture and camera-roll selection on your phone over the normal HTTPS development deployment. Hardware capture and hosted Storage network operations are not claimed as verified by fixture tests.
