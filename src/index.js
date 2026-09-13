import fs from "node:fs";
import path from "node:path";
import { loadConfig, ROOT } from "./config.js";
import { computeWindows, shouldRunNow } from "./schedule.js";
import { loadProfile } from "./profile.js";
import { fetchInstagramPosts } from "./instagram.js";
import { runResearch } from "./research.js";
import { curate } from "./curate.js";
import { verify, applyVerification, itemsToVerify } from "./verify.js";
import { assemble } from "./assemble.js";
import { renderEmail } from "./render.js";
import { sendEmail } from "./send.js";
import { readRecent, nextIssueNumber, writeIssue } from "./archive.js";
import { mergeUsage, emptyUsage, estimateCost } from "./claude.js";

const ts = () => new Date().toISOString().slice(11, 19);
const log = {
  info: (m) => console.log(`${ts()} ${m}`),
  warn: (m) => console.warn(`${ts()} WARN ${m}`),
  error: (m) => console.error(`${ts()} ERROR ${m}`),
};

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function writeOut(files) {
  const dir = path.join(ROOT, "out");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

const tally = (results) => {
  const t = {};
  for (const r of results.values()) t[r.status] = (t[r.status] ?? 0) + 1;
  return t;
};

async function main() {
  const t0 = Date.now();
  const cfg = loadConfig();
  const gate = shouldRunNow({ eventName: cfg.eventName, force: cfg.force });
  log.info(gate.reason);
  setOutput("built", "false");
  setOutput("sent", "false");
  if (!gate.run) return;

  if (!cfg.hasAnthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const hasProvider = cfg.email.resendApiKey || (cfg.email.gmailUser && cfg.email.gmailAppPassword);
  if (!cfg.dryRun && !hasProvider) throw new Error("No email provider configured: set RESEND_API_KEY, or GMAIL_USER and GMAIL_APP_PASSWORD (or DRY_RUN=1)");

  const windows = computeWindows();
  const profile = loadProfile();
  const recent = readRecent(8);
  const issueNumber = nextIssueNumber();
  setOutput("week_of", windows.today);
  log.info(
    `issue ${issueNumber} · this week ${windows.thisWindow.start} to ${windows.thisWindow.end} · radar to ${windows.radar.end} · models research=${cfg.models.research} curate=${cfg.models.curate} verify=${cfg.models.verify}${cfg.lanes ? ` · lanes=${cfg.lanes.join(",")}` : ""}${cfg.dryRun ? " · DRY RUN" : ""}`,
  );

  // 1. Instagram scrape starts now. Only the Instagram lane waits for it; the six web lanes start immediately.
  const instagramPromise = fetchInstagramPosts({ cfg, profile, log }).then((r) => {
    if (!r.ok) log.info(`[instagram] ${r.error}`);
    return r;
  });

  // 2. Research lanes in parallel
  const research = await runResearch({ cfg, profile, windows, instagramPosts: instagramPromise.then((r) => r.posts), log });
  const instagram = await instagramPromise;
  if (!research.candidates.length) throw new Error("research produced zero usable candidates; nothing to send");

  // 3. Curate
  let candidates = research.candidates;
  let { curated, usage: curateUsage } = await curate({ cfg, profile, windows, candidates, recent, laneReports: research.laneReports, log });

  // 4. Fact-check what was chosen, fold corrections into the pool, and re-curate if anything material moved
  const verification = new Map();
  let verifyUsage = emptyUsage();
  let changes = [];
  let secondPass = false;
  if (!cfg.skipVerify) {
    const first = await verify({ cfg, windows, curated, candidates, log });
    for (const [id, r] of first.results) verification.set(id, r);
    verifyUsage = mergeUsage(verifyUsage, first.usage);
    const applied = applyVerification(candidates, first.results);
    candidates = applied.candidates;
    changes = applied.changes;
    if (changes.length) log.info(`[verify] ${changes.join("; ")}`);

    if (applied.material) {
      secondPass = true;
      const again = await curate({ cfg, profile, windows, candidates, recent, laneReports: research.laneReports, previous: curated, corrections: changes, log });
      curated = again.curated;
      curateUsage = mergeUsage(curateUsage, again.usage);

      const fresh = itemsToVerify(curated, candidates).filter((c) => !verification.has(c.id));
      if (fresh.length) {
        log.info(`[verify] second pass introduced ${fresh.length} unchecked item${fresh.length > 1 ? "s" : ""}; checking`);
        const second = await verify({ cfg, windows, curated, candidates, only: fresh, log });
        for (const [id, r] of second.results) verification.set(id, r);
        verifyUsage = mergeUsage(verifyUsage, second.usage);
        const applied2 = applyVerification(candidates, second.results);
        candidates = applied2.candidates;
        changes = [...changes, ...applied2.changes];
        if (applied2.changes.length) log.info(`[verify] ${applied2.changes.join("; ")}`);
      }
    }
  }

  // 5. Assemble, render
  const usage = mergeUsage(research.usage, curateUsage, verifyUsage);
  const stats = {
    searches: usage.searches,
    fetches: usage.fetches,
    requests: usage.requests,
    inputTokens: usage.input + usage.cacheRead + usage.cacheWrite,
    outputTokens: usage.output,
    estimatedCostUsd: estimateCost(usage, cfg.models.research),
    candidates: research.candidates.length,
    instagramPosts: instagram.posts.length,
    verification: tally(verification),
    corrections: changes.length,
    secondPass,
    durationSec: Math.round((Date.now() - t0) / 1000),
  };
  const issue = assemble({ curated, candidates, verification, windows, issueNumber, laneReports: research.laneReports, stats });
  issue.repoUrl = cfg.repoUrl;
  const { html, text } = renderEmail(issue);

  const outDir = writeOut({ "email.html": html, "email.txt": text, "issue.json": JSON.stringify(issue, null, 2) });
  setOutput("built", "true");
  log.info(
    `built "${issue.subject}" · ${issue.picks.length} picks, ${issue.radar.length} radar, ${issue.anytime.length} anytime, family ${issue.family ? "yes" : "no"} · ${stats.searches} searches, ${stats.fetches} fetches, ~$${stats.estimatedCostUsd}, ${stats.durationSec}s${secondPass ? " · second curation pass" : ""} · written to ${path.relative(ROOT, outDir)}/`,
  );

  if (cfg.dryRun) {
    log.info("DRY_RUN set: not sending, not archiving");
    return;
  }

  // 6. Send, then archive (the archive is what keeps next week from repeating this one)
  await sendEmail({ cfg, subject: issue.subject, html, text, log });
  const dir = writeIssue({
    issue,
    html,
    text,
    research: {
      candidates,
      laneReports: research.laneReports,
      dropped: research.dropped,
      instagram: { ok: instagram.ok, error: instagram.error, posts: instagram.posts.length, accounts: instagram.accounts },
      verification: Object.fromEntries(verification),
      corrections: changes,
    },
    run: { gate, windows, models: cfg.models, effort: cfg.effort, usage, stats, sentTo: cfg.email.to, generatedAt: issue.generatedAt },
  });
  setOutput("sent", "true");
  log.info(`archived to ${path.relative(ROOT, dir)}/`);
}

main().catch((err) => {
  log.error(err?.stack ?? String(err));
  process.exitCode = 1;
});
