// Find the official composer model seat's slot registration (id + priority), so a
// takeover can shadow it with the documented lowest-priority-wins rule.
// usage: node probe-seat-registration.mjs <app.asar>
import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2]);
const text = buf.toString("latin1");
const needles = [
  'name: "conversation.input.model"',
  "name: 'conversation.input.model'",
  'conversation.input.model", { kind',
  "priority:",
];

for (const needle of needles) {
  let index = 0;
  let hits = 0;
  const samples = [];
  while ((index = text.indexOf(needle, index)) !== -1 && hits < 600) {
    hits += 1;
    const window = buf.subarray(Math.max(0, index - 380), index + 300).toString("utf8").replace(/\s+/g, " ");
    if (needle === "priority:" && window.includes("conversation.input.model") === false) {
      index += needle.length;
      continue;
    }
    if (samples.length < 5) samples.push(window);
    index += needle.length;
  }
  console.log(`\n===== ${needle} (x${hits}) =====`);
  for (const sample of samples) console.log("  · " + sample.slice(0, 680));
}
