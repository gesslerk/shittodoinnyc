/**
 * Bauhaus email. Tables and inline styles only, so it renders the same in Gmail,
 * Apple Mail and on a phone. The visual system:
 *   - paper ground, black ink, three primaries
 *   - Kandinsky's pairing: blue circle, red square, yellow triangle
 *     circle = the guys, square = date night, triangle = family, both = either
 *   - thick rules, big numerals, flush-left type, no decoration that is not structural
 */

const C = {
  paper: "#F3EFE6",
  ink: "#121212",
  red: "#D7261E",
  blue: "#1F4E9C",
  yellow: "#F5C518",
  white: "#FFFFFF",
  grey: "#5B5B5B",
};
const FONT = "'Futura', 'Futura PT', 'Century Gothic', 'Avenir Next', 'Trebuchet MS', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const WHO = {
  guys: { glyph: "●", label: "THE GUYS", color: C.blue, ink: C.white },
  wife: { glyph: "■", label: "DATE NIGHT", color: C.red, ink: C.white },
  either: { glyph: "●■", label: "GUYS OR DATE", color: C.ink, ink: C.paper },
  family: { glyph: "▲", label: "WITH THE KID", color: C.yellow, ink: C.ink },
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const up = (s) => esc(String(s ?? "").toUpperCase());
const who = (k) => WHO[k] ?? WHO.either;
const pad2 = (n) => String(n).padStart(2, "0");

function metaLine(item) {
  const where = [item.venue, item.neighborhood].filter(Boolean).join(", ");
  const bits = [item.when, where, item.price].filter(Boolean);
  return bits.map(esc).join(" &nbsp;·&nbsp; ") + (item.splurge ? ` &nbsp;·&nbsp; <span style="color:${C.red};">SPLURGE</span>` : "");
}

function sectionHead(title, shapeColor, right = "", shape = "square") {
  const shapeHtml =
    shape === "circle"
      ? `<div style="width:18px;height:18px;background:${shapeColor};border-radius:50%;font-size:0;line-height:0;">&nbsp;</div>`
      : shape === "triangle"
        ? `<div style="font:900 20px/18px ${FONT};color:${shapeColor};">▲</div>`
        : `<div style="width:18px;height:18px;background:${shapeColor};font-size:0;line-height:0;">&nbsp;</div>`;
  return `
<tr><td style="padding:30px 0 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="22" style="vertical-align:middle;">${shapeHtml}</td>
    <td style="vertical-align:middle;padding-left:10px;font:800 14px/1 ${FONT};letter-spacing:4px;color:${C.ink};">${title}</td>
    <td align="right" style="vertical-align:middle;font:700 10px/1.3 ${FONT};letter-spacing:2px;color:${C.grey};">${right}</td>
  </tr></table>
  <div style="height:3px;background:${C.ink};margin-top:10px;font-size:0;line-height:0;">&nbsp;</div>
</td></tr>`;
}

function pickCard(p, index) {
  const w = who(p.who);
  const headsUp = p.heads_up
    ? `<div style="margin-top:14px;border-left:6px solid ${C.red};padding:4px 0 4px 12px;font:400 13px/1.45 ${FONT};color:${C.ink};"><span style="font-weight:800;font-size:10px;letter-spacing:3px;">HEADS UP</span><br>${esc(p.heads_up)}</div>`
    : "";
  const invite = p.invite_text
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;background:${C.yellow};"><tr><td style="padding:12px 14px;">
        <div style="font:800 10px/1 ${FONT};letter-spacing:3px;color:${C.ink};">COPY-PASTE TO THE GROUP CHAT</div>
        <div style="font:400 15px/1.45 ${FONT};color:${C.ink};margin-top:6px;">&ldquo;${esc(p.invite_text)}&rdquo;</div>
      </td></tr></table>`
    : "";
  return `
<tr><td style="padding:0 0 18px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:3px solid ${C.ink};background:${C.white};border-collapse:collapse;">
    <tr>
      <td width="76" style="width:76px;background:${w.color};color:${w.ink};text-align:center;vertical-align:top;padding:20px 0 16px;border-right:3px solid ${C.ink};">
        <div style="font:900 32px/1 ${FONT};">${pad2(index + 1)}</div>
        <div style="font:400 26px/1 ${FONT};margin-top:12px;">${w.glyph}</div>
      </td>
      <td style="padding:18px 20px 20px;vertical-align:top;">
        <div style="font:800 11px/1 ${FONT};letter-spacing:3px;color:${w.color === C.yellow ? C.ink : w.color};">${w.label} &nbsp;·&nbsp; ${up(p.category)}</div>
        <div style="font:900 24px/1.08 ${FONT};color:${C.ink};margin:8px 0 10px;">${esc(p.headline)}</div>
        <div style="font:700 12px/1.6 ${FONT};letter-spacing:1px;text-transform:uppercase;color:${C.ink};">${metaLine(p)}</div>
        <p style="font:400 15px/1.5 ${FONT};color:#222222;margin:12px 0 0;">${esc(p.why)}</p>
        ${headsUp}
        ${invite}
        <div style="margin-top:16px;"><a href="${esc(p.url)}" style="display:inline-block;background:${C.ink};color:${C.paper};padding:11px 16px;font:800 11px/1 ${FONT};letter-spacing:3px;text-decoration:none;">DETAILS + TICKETS</a></div>
      </td>
    </tr>
  </table>
</td></tr>`;
}

function listRow(item, { last = false, lead = "" } = {}) {
  const w = who(item.who);
  return `
<tr><td style="padding:14px 18px;${last ? "" : `border-bottom:3px solid ${C.ink};`}">
  <div style="font:800 10px/1.4 ${FONT};letter-spacing:3px;color:${C.red};">${lead ? `${up(lead)} &nbsp;·&nbsp; ` : ""}<span style="color:${w.color === C.yellow ? C.ink : w.color};">${w.glyph} ${w.label}</span></div>
  <div style="font:900 18px/1.12 ${FONT};color:${C.ink};margin:6px 0 6px;">${esc(item.headline)}</div>
  <div style="font:700 11px/1.6 ${FONT};letter-spacing:1px;text-transform:uppercase;color:${C.ink};">${metaLine(item)}</div>
  <p style="font:400 14px/1.5 ${FONT};color:#222222;margin:8px 0 10px;">${esc(item.why)}</p>
  ${item.heads_up ? `<div style="font:400 12px/1.45 ${FONT};color:${C.red};margin:0 0 10px;">${esc(item.heads_up)}</div>` : ""}
  <a href="${esc(item.url)}" style="font:800 11px/1 ${FONT};letter-spacing:3px;color:${C.ink};text-decoration:underline;">DETAILS</a>
</td></tr>`;
}

function boxed(rows) {
  return `
<tr><td style="padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:3px solid ${C.ink};background:${C.white};border-collapse:collapse;">${rows}</table>
</td></tr>`;
}

const strip = () => `
<tr><td style="padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:${C.red};height:12px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="background:${C.yellow};height:12px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="background:${C.blue};height:12px;font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>
</td></tr>`;

function masthead(issue) {
  return `
<tr><td style="background:${C.ink};padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td colspan="2" style="padding:24px 28px 0;font:700 11px/1.4 ${FONT};letter-spacing:4px;color:${C.yellow};">NO. ${pad2(issue.issue)} &nbsp;·&nbsp; ${up(issue.weekOfLabel)}</td></tr>
    <tr>
      <td style="padding:14px 16px 24px 28px;vertical-align:bottom;">
        <div style="font:900 48px/0.92 ${FONT};letter-spacing:-1px;color:${C.paper};text-transform:uppercase;">Shit<br>to do<br>in NYC</div>
      </td>
      <td width="132" align="right" style="padding:14px 28px 24px 0;vertical-align:bottom;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
          <tr>
            <td style="padding:0 6px 6px 0;"><div style="width:56px;height:56px;background:${C.blue};border-radius:50%;font-size:0;line-height:0;">&nbsp;</div></td>
            <td style="padding:0 0 6px 0;"><div style="width:56px;height:56px;background:${C.red};font-size:0;line-height:0;">&nbsp;</div></td>
          </tr>
          <tr>
            <td style="padding:0 6px 0 0;text-align:center;vertical-align:bottom;"><div style="font:400 50px/56px ${FONT};color:${C.yellow};">▲</div></td>
            <td style="padding:0;"><div style="width:56px;height:56px;background:${C.paper};font-size:0;line-height:0;">&nbsp;</div></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>`;
}

export function renderHtml(issue) {
  const picks = issue.picks.map((p, i) => pickCard(p, i)).join("");
  const windowLabel = `${up(issue.windows.this.start.slice(5).replace("-", "/"))} TO ${up(issue.windows.this.end.slice(5).replace("-", "/"))}`;

  const radar = issue.radar.length
    ? sectionHead("BOOK NOW", C.red, "THE NEXT SIX WEEKS") +
      boxed(issue.radar.map((r, i) => listRow(r, { last: i === issue.radar.length - 1, lead: r.book_by ? `BOOK BY ${r.book_by}` : "ON THE RADAR" })).join(""))
    : "";
  const anytime = issue.anytime.length
    ? sectionHead("ANYTIME", C.yellow, "NOT TIED TO A DATE") + boxed(issue.anytime.map((a, i) => listRow(a, { last: i === issue.anytime.length - 1 })).join(""))
    : "";
  const family = issue.family
    ? sectionHead("WITH THE KID", C.yellow, "WEEKEND DAYTIME", "triangle") + pickCard({ ...issue.family, who: "family" }, 0).replace(`>${pad2(1)}<`, ">▲<").replace(`<div style="font:400 26px/1 ${FONT};margin-top:12px;">▲</div>`, "")
    : "";

  const preheader = esc(issue.opener).slice(0, 140);
  const legend = `<span style="color:${C.blue};">●</span> the guys &nbsp; <span style="color:${C.red};">■</span> date night &nbsp; <span style="color:${C.ink};">●■</span> either &nbsp; <span style="color:#C9A200;">▲</span> with the kid`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(issue.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
<tr><td align="center" style="padding:24px 12px 44px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
${masthead(issue)}
${strip()}
<tr><td style="padding:24px 4px 0;">
  <p style="font:500 18px/1.45 ${FONT};color:${C.ink};margin:0;">${esc(issue.opener)}</p>
  <div style="font:400 12px/1.6 ${FONT};color:${C.grey};margin-top:14px;">${legend}</div>
</td></tr>
${sectionHead("THIS WEEK", C.blue, windowLabel, "circle")}
${picks || `<tr><td style="font:400 15px/1.5 ${FONT};color:${C.ink};padding:0 4px;">Nothing cleared the bar this week. See the notes at the bottom.</td></tr>`}
${radar}
${anytime}
${family}
<tr><td style="padding:30px 4px 0;">
  <div style="height:3px;background:${C.ink};font-size:0;line-height:0;">&nbsp;</div>
  ${issue.notes ? `<p style="font:400 13px/1.55 ${FONT};color:${C.ink};margin:16px 0 0;"><span style="font-weight:800;letter-spacing:3px;font-size:10px;">NOTES</span><br>${esc(issue.notes)}</p>` : ""}
  <p style="font:400 12px/1.6 ${FONT};color:${C.grey};margin:18px 0 0;">Built Monday morning by a robot that read your Spotify library and ${esc(issue.stats?.searches ?? "a few dozen")} web searches. Not a newsletter, not for forwarding. To tune it, edit <a href="${esc(issue.repoUrl ?? "https://github.com/gesslerk/shittodoinnyc")}" style="color:${C.ink};">profile/konrad.md and profile/feedback.md</a> in the repo.</p>
</td></tr>
<tr><td style="padding:22px 0 0;">${strip().replace(/<tr><td style="padding:0;">|<\/td><\/tr>$/g, "")}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderText(issue) {
  const L = [];
  L.push(`SHIT TO DO IN NYC  ·  No. ${pad2(issue.issue)}  ·  ${issue.weekOfLabel}`);
  L.push("=".repeat(60));
  L.push("");
  L.push(issue.opener);
  L.push("");
  const item = (p, i, withInvite) => {
    const w = who(p.who);
    L.push(`${i != null ? `${pad2(i + 1)}. ` : ""}${p.headline}  [${w.label.toLowerCase()}, ${p.category}]`);
    L.push(`    ${[p.when, [p.venue, p.neighborhood].filter(Boolean).join(", "), p.price, p.splurge ? "splurge" : ""].filter(Boolean).join("  ·  ")}`);
    L.push(`    ${p.why}`);
    if (p.heads_up) L.push(`    Heads up: ${p.heads_up}`);
    if (withInvite && p.invite_text) L.push(`    Text to send: "${p.invite_text}"`);
    L.push(`    ${p.url}`);
    L.push("");
  };
  L.push("THIS WEEK");
  L.push("-".repeat(60));
  issue.picks.forEach((p, i) => item(p, i, true));
  if (issue.radar.length) {
    L.push("BOOK NOW (the next six weeks)");
    L.push("-".repeat(60));
    issue.radar.forEach((r) => item({ ...r, headline: `${r.book_by ? `[book by ${r.book_by}] ` : ""}${r.headline}` }, null, false));
  }
  if (issue.anytime.length) {
    L.push("ANYTIME");
    L.push("-".repeat(60));
    issue.anytime.forEach((a) => item(a, null, false));
  }
  if (issue.family) {
    L.push("WITH THE KID");
    L.push("-".repeat(60));
    item({ ...issue.family, who: "family" }, null, true);
  }
  if (issue.notes) {
    L.push("NOTES");
    L.push(issue.notes);
    L.push("");
  }
  L.push(`Tune it: ${issue.repoUrl ?? "https://github.com/gesslerk/shittodoinnyc"} (profile/konrad.md, profile/feedback.md)`);
  return L.join("\n");
}

export function renderEmail(issue) {
  return { html: renderHtml(issue), text: renderText(issue) };
}
