// Find how the official model seat occupies its slot, and whether a plugin can
// take that slot over. Prints every occurrence window around the interesting
// tokens in the packaged bundles.
// usage: node probe-slots.mjs <app.asar>
import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2]);
const text = buf.toString("latin1");
const needles = [
  "conversation.input.model",
  "data-slot",
  "slotName",
  'kind: "single"',
  'kind:"single"',
];

for (const needle of needles) {
  let index = 0;
  let hits = 0;
  const samples = [];
  while ((index = text.indexOf(needle, index)) !== -1 && hits < 500) {
    hits += 1;
    if (samples.length < 6) {
      const window = buf.subarray(Math.max(0, index - 300), index + 320).toString("utf8").replace(/\s+/g, " ");
      if (window.includes("conversation.input.model") || window.includes("data-slot")) samples.push(window);
    }
    index += needle.length;
  }
  console.log(`\n===== ${needle} (x${hits}) =====`);
  for (const sample of samples) console.log("  · " + sample.slice(0, 600));
}
