/**
 * Instagram coverage.
 *
 * Instagram has no public API for reading other people's posts, and its pages do not
 * load without a login, so web search alone finds only what the search index happens
 * to have. Two tiers:
 *
 *   Tier A (always on): the "instagram" research lane searches the index with
 *     site:instagram.com queries built from the handles in profile/instagram.md.
 *
 *   Tier B (when APIFY_TOKEN is set): this module pulls the last N days of posts from
 *     every handle via Apify's Instagram Scraper (actor apify/instagram-scraper) and
 *     hands the captions to the lane as primary evidence. About $1.50 per 1,000 posts.
 *     Scraping public Instagram pages is against Instagram's terms of use; Apify runs
 *     it on their infrastructure and you accept that trade-off by setting the token.
 */

const API = "https://api.apify.com/v2";

export function parseHandles(md) {
  const handles = [];
  for (const raw of md.split("\n")) {
    const m = raw.trim().match(/^[-*]\s+@([A-Za-z0-9._]+)\s*(?:\|\s*(.*))?$/);
    if (m) handles.push({ handle: m[1].toLowerCase(), note: (m[2] ?? "").trim() });
  }
  return handles;
}

function normalizePost(item) {
  const shortCode = item.shortCode ?? item.shortcode ?? item.code ?? null;
  const url = item.url ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : null);
  const tsRaw = item.timestamp ?? item.takenAt ?? item.takenAtTimestamp ?? null;
  let timestamp = null;
  if (typeof tsRaw === "number") timestamp = new Date(tsRaw * (tsRaw < 1e12 ? 1000 : 1)).toISOString();
  else if (typeof tsRaw === "string" && !Number.isNaN(Date.parse(tsRaw))) timestamp = new Date(tsRaw).toISOString();
  const account = item.ownerUsername ?? item.username ?? item.owner?.username ?? (item.inputUrl ? item.inputUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "") : "unknown");
  const caption = String(item.caption ?? item.text ?? item.title ?? "").replace(/\s+/g, " ").trim();
  return { account, url, timestamp, caption, location: item.locationName ?? item.location?.name ?? null, type: item.type ?? item.productType ?? null };
}

async function apify(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apify ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Returns { posts, ok, error, accounts }. Never throws: an Instagram failure must not
 * stop the rest of the email, so problems are reported and the lane falls back to search.
 */
export async function fetchInstagramPosts({ cfg, profile, log = console, sleepMs = 10000 }) {
  const handles = parseHandles(profile.instagram ?? "");
  const base = { posts: [], ok: false, error: null, accounts: handles.length };
  if (!cfg.apify.token) return { ...base, error: "APIFY_TOKEN not set; Instagram lane will rely on search only" };
  if (!handles.length) return { ...base, error: "profile/instagram.md lists no handles" };

  const started = Date.now();
  try {
    const input = {
      directUrls: handles.map((h) => `https://www.instagram.com/${h.handle}/`),
      resultsType: "posts",
      resultsLimit: cfg.apify.postsPerAccount,
      onlyPostsNewerThan: `${cfg.apify.daysBack} days`,
      addParentData: false,
    };
    const run = await apify(`/actors/${cfg.apify.actor}/runs?timeout=${cfg.apify.timeoutSec}&waitForFinish=60`, { token: cfg.apify.token, method: "POST", body: input });
    const runId = run?.data?.id;
    const datasetId = run?.data?.defaultDatasetId;
    if (!runId || !datasetId) throw new Error(`unexpected run response: ${JSON.stringify(run).slice(0, 200)}`);
    log.info(`[instagram] Apify run ${runId} started for ${handles.length} accounts`);

    const deadline = Date.now() + (cfg.apify.timeoutSec + 60) * 1000;
    let status = run.data.status;
    while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      if (Date.now() > deadline) throw new Error(`run ${runId} did not finish within ${cfg.apify.timeoutSec}s (status ${status})`);
      await new Promise((r) => setTimeout(r, sleepMs));
      const poll = await apify(`/actor-runs/${runId}`, { token: cfg.apify.token });
      status = poll?.data?.status ?? status;
    }
    if (status !== "SUCCEEDED") throw new Error(`run ${runId} ended with status ${status}`);

    const items = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await apify(`/datasets/${datasetId}/items?format=json&clean=true&limit=1000&offset=${offset}`, { token: cfg.apify.token });
      if (!Array.isArray(page) || !page.length) break;
      items.push(...page);
      if (page.length < 1000) break;
    }
    const posts = items
      .map(normalizePost)
      .filter((p) => p.url && p.caption)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    log.info(`[instagram] ${posts.length} posts from ${new Set(posts.map((p) => p.account)).size} accounts in ${Math.round((Date.now() - started) / 1000)}s`);
    return { ...base, posts, ok: true };
  } catch (err) {
    log.warn(`[instagram] ${err.message}`);
    return { ...base, error: err.message };
  }
}

/** Compact text block for the research prompt. Captions are trimmed so a long run stays cheap. */
export function formatPostsForPrompt(posts, { maxCaption = 700 } = {}) {
  return posts
    .map((p) => {
      const when = p.timestamp ? p.timestamp.slice(0, 10) : "date unknown";
      const cap = p.caption.length > maxCaption ? `${p.caption.slice(0, maxCaption)}…` : p.caption;
      return `@${p.account} · posted ${when}${p.location ? ` · ${p.location}` : ""} · ${p.url}\n${cap}`;
    })
    .join("\n\n");
}
