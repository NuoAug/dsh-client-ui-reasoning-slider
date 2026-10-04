// How does the slots service treat a second registration into a "single" slot?
// usage: node probe-single.mjs <app.asar>
import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2]);
const text = buf.toString("latin1");
const needles = [
  "already occupied",
  "single slot",
  "occupied",
  'kind === "single"',
  "kind===\"single\"",
  "data-slot",
];

for (const needle of needles) {
  let index = 0;
  let hits = 0;
  const samples = [];
  while ((index = text.indexOf(needle, index)) !== -1 && hits < 400) {
    hits += 1;
    if (samples.length < 4) {
      const window = buf.subarray(Math.max(0, index - 320), index + 340).toString("utf8").replace(/\s+/g, " ");
      samples.push(window);
    }
    index += needle.length;
  }
  console.log(`\n===== ${needle} (x${hits}) =====`);
  for (const sample of samples) console.log("  · " + sample.slice(0, 620));
}
