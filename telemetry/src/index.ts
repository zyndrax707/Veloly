interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  DISCORD_FEEDBACK_WEBHOOK_URL?: string;
}

const RATE_WINDOW_SECONDS = 15 * 60;

const allowedOrigins = new Set([
  "https://veloly-site.vercel.app",
  "https://noob20-crt.github.io",
  "https://zyndrax707.github.io",
  "tauri://localhost",
  "https://tauri.localhost",
  "http://tauri.localhost",
  "http://localhost:1420",
]);

function responseJson(data: unknown, status = 200, origin: string | null = null, extra: HeadersInit = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function sameSecret(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

async function hashInstallId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

async function readJson(request: Request, maxBytes = 2_048): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) return null;
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function playlistSlug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "playlist";
}

function shareId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sharedPlaylistPage(name: string, owner: string, tracks: SharedTrack[]): Response {
  const rows = tracks.map((track, index) => `<li><span>${index + 1}</span><div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}${track.album ? ` · ${escapeHtml(track.album)}` : ""}</small></div></li>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080510"><title>${escapeHtml(name)} · Playlist Veloly</title><style>
    :root{color-scheme:dark;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;background:#080510;color:#f5f3fa}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(ellipse at 50% 0%,#35104d 0,transparent 58%),#080510}.card{width:min(680px,100%);padding:28px;border:1px solid #ffffff20;border-radius:24px;background:#120d1bef;box-shadow:0 28px 90px #0009}.eyebrow{color:#d17aff;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}h1{margin:8px 0 4px;font-size:clamp(25px,6vw,40px);overflow-wrap:anywhere}.by{margin:0 0 22px;color:#aaa3b5;font-size:14px}ol{display:grid;gap:2px;max-height:55vh;overflow:auto;margin:0;padding:0;list-style:none}li{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:10px 8px;border-bottom:1px solid #ffffff0c}li>span{color:#888096;font-size:12px;text-align:center}li div{display:grid;gap:3px;min-width:0}li strong,li small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}li strong{font-size:14px}li small{color:#aaa3b5;font-size:12px}.foot{margin-top:22px;padding:12px 14px;border-radius:14px;background:#ffffff0c;color:#bdb6c9;font-size:12px;line-height:1.5}.brand{margin-top:18px;color:#d17aff;font-size:12px;font-weight:700}
  </style></head><body><main class="card"><div class="eyebrow">Playlist partagée · Veloly</div><h1>${escapeHtml(name)}</h1><p class="by">Partagée par ${escapeHtml(owner)} · ${tracks.length} morceaux</p><ol>${rows}</ol><p class="foot">Pour l’ajouter à ta collection, ouvre Veloly, choisis « Importer une playlist » et colle ce lien. Les fichiers locaux du créateur ne sont pas inclus ; Veloly cherchera ces titres dans les catalogues disponibles.</p><div class="brand">Veloly · musique, à ta façon</div></main></body></html>`;
  return new Response(html, { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  } });
}

interface SharedTrack { source: "deezer" | "youtube" | "jamendo" | "metadata"; remoteId: string | null; title: string; artist: string; album: string | null; duration: number | null }
interface SharedPlaylistRow { share_id: string; owner_id: string; playlist_name: string; tracks_json: string; created_at: number; username: string }

async function findSharedPlaylist(env: Env, id: string): Promise<{ row: SharedPlaylistRow; tracks: SharedTrack[] } | null> {
  const row = await env.DB.prepare("SELECT shared_playlists.share_id, shared_playlists.owner_id, shared_playlists.playlist_name, shared_playlists.tracks_json, shared_playlists.created_at, COALESCE(users.username, 'Veloly') AS username FROM shared_playlists LEFT JOIN users ON users.id = shared_playlists.owner_id WHERE shared_playlists.share_id = ?")
    .bind(id).first<SharedPlaylistRow>();
  if (!row) return null;
  try {
    const tracks: unknown = JSON.parse(row.tracks_json);
    return Array.isArray(tracks) ? { row, tracks: tracks as SharedTrack[] } : null;
  } catch { return null; }
}

function apiError(code: string, status: number, origin: string | null) {
  return responseJson({ error: code }, status, origin);
}

async function rateLimit(env: Env, key: string, maxAttempts: number, now: number): Promise<boolean> {
  const rateKey = await hashInstallId(key);
  await env.DB.prepare(
    "INSERT INTO auth_rate_limits (rate_key, window_started, attempts) VALUES (?, ?, 1) ON CONFLICT(rate_key) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started = CASE WHEN auth_rate_limits.window_started <= ? THEN excluded.window_started ELSE auth_rate_limits.window_started END",
  ).bind(rateKey, now, now - RATE_WINDOW_SECONDS, now - RATE_WINDOW_SECONDS).run();
  const current = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE rate_key = ?")
    .bind(rateKey).first<{ attempts: number }>();
  return (current?.attempts ?? maxAttempts + 1) <= maxAttempts;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin && !allowedOrigins.has(origin)) return responseJson({ error: "origin_not_allowed" }, 403);

    if (request.method === "OPTIONS") {
      if (!origin || (origin !== url.origin && !allowedOrigins.has(origin))) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, PUT, DELETE, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/shared-playlists") {
      const now = Math.floor(Date.now() / 1000);
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (!await rateLimit(env, `share:${ip}`, 12, now)) return apiError("rate_limited", 429, origin);
      const body = await readJson(request, 180_000);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const inputTracks = body?.tracks;
      if (!name || Array.from(name).length > 120 || !Array.isArray(inputTracks) || inputTracks.length < 1 || inputTracks.length > 300) {
        return apiError("invalid_shared_playlist", 400, origin);
      }
      const tracks: SharedTrack[] = [];
      for (const item of inputTracks) {
        if (typeof item !== "object" || item === null) return apiError("invalid_shared_playlist", 400, origin);
        const track = item as Record<string, unknown>;
        const title = typeof track.title === "string" ? track.title.trim() : "";
        const artist = typeof track.artist === "string" ? track.artist.trim() : "";
        const album = typeof track.album === "string" ? track.album.trim() : null;
        const source = track.source;
        const remoteId = typeof track.remoteId === "string" ? track.remoteId.trim() : null;
        const duration = typeof track.duration === "number" && Number.isFinite(track.duration) && track.duration >= 0 && track.duration <= 86_400 ? track.duration : null;
        if (!title || !artist || Array.from(title).length > 300 || Array.from(artist).length > 300 || (album !== null && Array.from(album).length > 300)) {
          return apiError("invalid_shared_playlist", 400, origin);
        }
        const canUseRemoteId = (source === "deezer" || source === "youtube" || source === "jamendo") && remoteId !== null && remoteId.length <= 200;
        tracks.push({ source: canUseRemoteId ? source : "metadata", remoteId: canUseRemoteId ? remoteId : null, title, artist, album: album || null, duration });
      }
      const id = shareId();
      await env.DB.prepare("INSERT INTO shared_playlists (share_id, owner_id, playlist_name, tracks_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, "anonymous", name, JSON.stringify(tracks), now).run();
      return responseJson({ url: new URL(`/s/${playlistSlug(name)}-${id}`, url.origin).toString() }, 201, origin);
    }

    const sharedApi = /^\/v1\/shared-playlists\/([a-f0-9]{24})$/.exec(url.pathname);
    if (request.method === "GET" && sharedApi) {
      const shared = await findSharedPlaylist(env, sharedApi[1]);
      if (!shared) return apiError("shared_playlist_not_found", 404, origin);
      return responseJson({ name: shared.row.playlist_name, owner: shared.row.username, tracks: shared.tracks }, 200, origin);
    }

    if (request.method === "GET" && url.pathname.startsWith("/s/")) {
      const segment = url.pathname.slice(3);
      const match = /(?:^|-)([a-f0-9]{24})$/i.exec(segment);
      const id = match?.[1] ?? null;
      if (!id) return new Response("Lien de playlist invalide.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      const shared = await findSharedPlaylist(env, id);
      if (!shared) return new Response("Cette playlist n'existe plus.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return sharedPlaylistPage(shared.row.playlist_name, shared.row.username, shared.tracks);
    }

    if ((request.method === "POST" || request.method === "DELETE") && url.pathname === "/v1/first-launch") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return responseJson({ error: "invalid_json" }, 400, origin);
      }
      const id = typeof body === "object" && body !== null && "installId" in body
        ? (body as { installId?: unknown }).installId
        : null;
      if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return responseJson({ error: "invalid_install_id" }, 400, origin);
      }
      const hash = await hashInstallId(id);
      if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM installs WHERE install_hash = ?").bind(hash).run();
        return responseJson({ deleted: true }, 200, origin);
      }
      const result = await env.DB.prepare(
        "INSERT INTO installs (install_hash, first_seen) VALUES (?, ?) ON CONFLICT(install_hash) DO NOTHING",
      ).bind(hash, Math.floor(Date.now() / 1000)).run();
      return responseJson({ recorded: (result.meta.changes ?? 0) > 0 }, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/v1/feedback") {
      if (!env.DISCORD_FEEDBACK_WEBHOOK_URL) return responseJson({ error: "feedback_unavailable" }, 503, origin);
      let body: unknown;
      try {
        if (Number(request.headers.get("Content-Length") ?? 0) > 12_000) return responseJson({ error: "message_too_long" }, 413, origin);
        body = await request.json();
      } catch {
        return responseJson({ error: "invalid_json" }, 400, origin);
      }
      const value = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      const category = value.category;
      const message = typeof value.message === "string" ? value.message.trim() : "";
      const version = typeof value.version === "string" && /^[0-9][0-9A-Za-z.+-]{0,30}$/.test(value.version) ? value.version : "unknown";
      const clientId = value.clientId;
      if (category !== "idea" && category !== "bug" && category !== "other") return responseJson({ error: "invalid_category" }, 400, origin);
      if (message.length < 8 || message.length > 1500) return responseJson({ error: "invalid_message_length" }, 400, origin);
      if (typeof clientId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
        return responseJson({ error: "invalid_client_id" }, 400, origin);
      }
      let webhook: URL;
      try {
        webhook = new URL(env.DISCORD_FEEDBACK_WEBHOOK_URL);
      } catch {
        return responseJson({ error: "feedback_unavailable" }, 503, origin);
      }
      if (webhook.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(webhook.hostname) || !webhook.pathname.startsWith("/api/webhooks/")) {
        return responseJson({ error: "feedback_unavailable" }, 503, origin);
      }

      const hash = await hashInstallId(clientId);
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("DELETE FROM feedback_rate_limits WHERE last_sent < ?").bind(now - 86_400).run();
      const previous = await env.DB.prepare("SELECT last_sent FROM feedback_rate_limits WHERE client_hash = ?").bind(hash).first<{ last_sent: number }>();
      if (previous && now - previous.last_sent < 60) return responseJson({ error: "rate_limited" }, 429, origin);

      let sent: Response;
      try {
        sent = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `**Veloly feedback · ${category}**\n**Version:** ${version}\n\n${message}`,
            allowed_mentions: { parse: [] },
          }),
        });
      } catch {
        return responseJson({ error: "discord_unavailable" }, 502, origin);
      }
      if (!sent.ok) return responseJson({ error: "discord_unavailable" }, 502, origin);
      await env.DB.prepare(
        "INSERT INTO feedback_rate_limits (client_hash, last_sent) VALUES (?, ?) ON CONFLICT(client_hash) DO UPDATE SET last_sent = excluded.last_sent",
      ).bind(hash, now).run();
      return responseJson({ sent: true }, 200, origin);
    }

    if (request.method === "GET" && url.pathname === "/v1/admin/stats") {
      const authorization = request.headers.get("Authorization") ?? "";
      const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!env.ADMIN_TOKEN || !sameSecret(supplied, env.ADMIN_TOKEN)) {
        return responseJson({ error: "unauthorized" }, 401, origin, { "WWW-Authenticate": "Bearer" });
      }
      const [total, recent] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS total FROM installs").first<{ total: number }>(),
        env.DB.prepare(
          "SELECT date(first_seen, 'unixepoch') AS day, COUNT(*) AS count FROM installs GROUP BY day ORDER BY day DESC LIMIT 30",
        ).all<{ day: string; count: number }>(),
      ]);
      return responseJson({ total: total?.total ?? 0, recent: recent.results }, 200, origin);
    }

    return responseJson({ error: "not_found" }, 404, origin);
  },
};
