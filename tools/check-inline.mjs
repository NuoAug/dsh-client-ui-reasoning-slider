// Syntax check every generated artifact: inline <script type="module"> blocks of
// an HTML file, or a plain .js/.mjs file checked as-is. A backtick inside one of
// the CSS comments in the component's template literal closes that literal early
// and breaks the bundle, so this runs on every build.
// usage: node tools/check-inline.mjs <file.html|file.js> [...more]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Run `node --check` on one source string; returns null when it parses. */
function check(label, source, suffix) {
  const target = join(tmpdir(), `inline-${suffix}-${Date.now()}.mjs`);
  writeFileSync(target, source, "utf8");
  const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
  if (result.status === 0) {
    console.log(`${label} ${source.length} bytes -> OK`);
    return null;
  }
  console.log(`${label} ${source.length} bytes -> SYNTAX ERROR`);
  // A sandboxed run can fail before node even starts (result.error) — say so
  // instead of throwing, otherwise the report hides the real verdict.
  const detail = result.error !== undefined && result.error !== null
    ? `spawn failed: ${result.error.message ?? result.error}`
    : String(result.stderr ?? "");
  return detail.split("\n").slice(0, 8).join("\n");
}

let failed = false;
for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  if (/\.(m?js)$/.test(file)) {
    const problem = check(`${file} [module]`, text, "module");
    if (problem !== null) {
      failed = true;
      console.log(problem);
    }
    continue;
  }
  const scripts = [...text.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  if (scripts.length === 0) {
    console.log(`${file}: no inline module script`);
    continue;
  }
  scripts.forEach((match, index) => {
    const problem = check(`${file} [script ${index}]`, match[1], String(index));
    if (problem !== null) {
      failed = true;
      console.log(problem);
    }
  });
}
process.exit(failed ? 1 : 0);
