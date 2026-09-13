// Tiny static server for previewing out/ in a browser. No dependencies.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/config.js";

const dir = path.join(ROOT, "out");
const port = Number(process.env.PORT ?? 8765);
const types = { ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };

http
  .createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = path.join(dir, name === "/" ? "sample.html" : name);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`serving ${dir} on http://localhost:${port}/`));
