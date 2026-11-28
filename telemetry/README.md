# Veloly first-launch counter

The counter is opt-in in the app. When enabled, one random installation UUID is sent once; the Worker stores only its SHA-256 hash and first-seen date. It does not receive account names, song data, listening history, or an IP field. Turning the setting off asks the Worker to remove that installation's count. The total is installations that opted in, not people or all downloads.

The feedback form is separate from the counter consent: nothing is sent until the user submits a message. The Worker forwards only the selected category, message and app version to the Veloly Discord webhook. It never sends songs or listening history. A hash of a random local client ID is kept in D1 for at most 24 hours to enforce a one-minute cooldown.

The static site cannot safely store an admin password or write protected statistics by itself. This Cloudflare Worker + D1 service provides the write endpoint and password-protected admin API. The admin page is available at `https://veloly-site.vercel.app/admin` (or `/admin.html`); the page asks for the Worker URL and the admin token each time and does not save either.

## One-time Cloudflare setup

Run these commands from this folder in PowerShell or a terminal with Node.js installed:

```powershell
npx wrangler login
npx wrangler d1 create veloly-first-launch
```

Copy the `database_id` returned by Cloudflare into `wrangler.toml`, replacing `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`. Then apply the table schema and create a strong admin secret:

```powershell
npx wrangler d1 migrations apply veloly-first-launch --remote
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put DISCORD_FEEDBACK_WEBHOOK_URL
npx wrangler deploy
```

When prompted for `ADMIN_TOKEN`, enter a long random password and keep it private. `wrangler deploy` prints the Worker URL (ending in `.workers.dev`).

Create the Discord webhook in a private channel for Veloly feedback, then paste its URL only into the `DISCORD_FEEDBACK_WEBHOOK_URL` prompt. Do not put the webhook URL in the app, a GitHub variable, or a committed file. The app sends feedback through the Worker, which keeps the webhook secret server-side. Run the D1 migrations again after updating this project so the feedback cooldown table exists.

## Connect app builds

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable**. Create `VELOLY_TELEMETRY_URL` with the Worker URL, without a trailing slash. The release workflow passes it to macOS, Windows, Android, and iOS builds. Until this variable is set, the app hides the opt-in setting and sends nothing.

For a local build, create `app/.env.local` with:

```text
VITE_VELOLY_TELEMETRY_URL=https://YOUR-WORKER-URL.workers.dev
```

Then rebuild the app. `.env.local` is ignored by Git.

## View the count

Open `site/admin.html` on the published site, enter the Worker URL and `ADMIN_TOKEN`, then select **Voir le compteur**. The API requires the bearer token; the browser page is only a viewer and contains no admin secret.

The counter cannot prove that a client is an authentic Veloly build: any public endpoint can be scripted. Treat it as an approximate count of installations that opted in. Cloudflare provides and operates the Worker/D1 infrastructure; review its current service and data-retention terms before enabling the endpoint.

## Accounts and playlist sharing

Veloly does not offer user accounts, sign-in, password recovery, or public profiles. Playlist links remain available without an account: creating a link stores only the playlist name and track metadata in D1 (never local files or file paths). Anyone with the link can view the snapshot and import it in Veloly by pasting the link in **Import playlist**. The public share endpoint is rate-limited. Existing links created by older Veloly versions remain readable. Migration `0005_shared_playlists.sql` must already be applied for playlist links to work.

The old account tables and records are intentionally left in D1 for now; this code no longer exposes account or profile routes. No remote account data is deleted automatically.
