import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/config.js";
import { renderEmail } from "../src/render.js";

const src = process.argv[2] ?? path.join(ROOT, "samples", "sample-issue.json");
const issue = JSON.parse(fs.readFileSync(src, "utf8"));
const { html, text } = renderEmail(issue);
const outDir = path.join(ROOT, "out");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sample.html"), html);
fs.writeFileSync(path.join(outDir, "sample.txt"), text);
console.log(`rendered ${path.relative(ROOT, src)} -> out/sample.html (${html.length} bytes) and out/sample.txt`);
