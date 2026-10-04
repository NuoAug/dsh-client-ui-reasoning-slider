// List every method the commandUi / command service exposes, to find the
// programmatic "open a registered command popup" entry point.
// usage: node probe-command-api.mjs <app.asar>
import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2]);
const text = buf.toString("latin1");
const needles = [
  "openCommand",
  "open(",
  "executeCommand",
  "runCommand",
  "commandUi",
  "popupSelect",
  '"command"',
];

for (const needle of needles) {
  let index = 0;
  let hits = 0;
  const samples = [];
  while ((index = text.indexOf(needle, index)) !== -1 && hits < 400) {
    hits += 1;
    if (samples.length < 3) {
      const window = buf.subarray(Math.max(0, index - 260), index + 260).toString("utf8");
      if (!window.includes("integrity")) samples.push(window.replace(/\s+/g, " ").slice(0, 420));
    }
    index += needle.length;
  }
  console.log(`\n===== ${needle} (x${hits}) =====`);
  for (const sample of samples) console.log("  " + sample);
}
