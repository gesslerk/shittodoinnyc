import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isTrue = (v) => /^(1|true|yes|on)$/i.test(String(v ?? "").trim());
const int = (v, fallback) => (Number.isFinite(Number(v)) && String(v).trim() !== "" ? Number(v) : fallback);

/**
 * Everything the run needs from the environment, in one place.
 * Secrets never get logged; see index.js for what is printed.
 */
export function loadConfig(env = process.env) {
  const model = env.MODEL || "claude-opus-5";
  return {
    models: {
      research: env.RESEARCH_MODEL || model,
      curate: env.CURATE_MODEL || model,
      verify: env.VERIFY_MODEL || model,
    },
    effort: {
      research: env.RESEARCH_EFFORT || "high",
      curate: env.CURATE_EFFORT || "high",
      verify: env.VERIFY_EFFORT || "medium",
    },
    limits: {
      searchesPerLane: int(env.MAX_SEARCHES_PER_LANE, 12),
      fetchesPerLane: int(env.MAX_FETCHES_PER_LANE, 10),
      verifyFetches: int(env.MAX_VERIFY_FETCHES, 24),
      verifySearches: int(env.MAX_VERIFY_SEARCHES, 10),
    },
    email: {
      to: env.EMAIL_TO || "gesslerk@gmail.com",
      from: env.EMAIL_FROM || "Shit To Do in NYC <onboarding@resend.dev>",
      resendApiKey: env.RESEND_API_KEY || "",
      gmailUser: env.GMAIL_USER || "",
      gmailAppPassword: env.GMAIL_APP_PASSWORD || "",
    },
    lanes: env.LANES ? env.LANES.split(",").map((s) => s.trim()).filter(Boolean) : null,
    apify: {
      token: env.APIFY_TOKEN || "",
      actor: env.APIFY_INSTAGRAM_ACTOR || "apify~instagram-scraper",
      postsPerAccount: int(env.INSTAGRAM_POSTS_PER_ACCOUNT, 8),
      daysBack: int(env.INSTAGRAM_DAYS_BACK, 14),
      timeoutSec: int(env.APIFY_TIMEOUT_SEC, 600),
    },
    skipVerify: isTrue(env.SKIP_VERIFY),
    dryRun: isTrue(env.DRY_RUN),
    force: isTrue(env.FORCE),
    eventName: env.GITHUB_EVENT_NAME || "local",
    timezone: "America/New_York",
    repoUrl: env.REPO_URL || "https://github.com/gesslerk/shittodoinnyc",
    hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
  };
}
