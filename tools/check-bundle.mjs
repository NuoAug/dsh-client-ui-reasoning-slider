// Simulate the DSH client-modules loader against a built bundle:
//   · the file must register exactly one factory,
//   · its id must equal the package name (the id the profile row resolves),
//   · the factory must export the plugin surface DSH looks for.
//
// usage: node tools/check-bundle.mjs lib/client.js
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const file = process.argv[2];
const source = readFileSync(file, "utf8");
const expectedId = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).name;

const registrations = [];
// Minimal renderer stubs: the factory defines a custom element class at module
// scope, which only needs these to exist.
class HTMLElementStub {}
globalThis.HTMLElement = HTMLElementStub;
globalThis.customElements = {
  get: () => undefined,
  define: () => {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      if (registrations.some((entry) => entry.id === spec.id)) {
        // This is exactly what aborted web boot: the loader imported one file
        // twice and the second registration was rejected.
        throw new Error(`duplicate factory registration for "${spec.id}" (bundle executed twice without invalidate?)`);
      }
      registrations.push(spec);
    },
    // DSH's loader also exposes a per-module require; the factory is what matters.
    require: () => ({}),
  },
};

await import(pathToFileURL(file).href);

let failed = false;
const fail = (message) => {
  failed = true;
  console.log(`FAIL  ${message}`);
};

if (registrations.length !== 1) fail(`expected 1 registration, got ${registrations.length}`);
else {
  const [spec] = registrations;
  console.log(`registration id   ${spec.id}`);
  if (spec.id !== expectedId) fail(`id must equal the package name "${expectedId}"`);
  const exportsObject = spec.factory(() => ({}));
  const names = Object.keys(exportsObject).sort();
  console.log(`factory exports   ${names.join(", ")}`);
  for (const key of ["apply", "inject", "ReasoningSeat", "ReasoningSlider", "REASONING_SLIDER_TAG"]) {
    if (key in exportsObject === false) fail(`factory must export ${key}`);
  }
  if (typeof exportsObject.apply !== "function") fail("apply must be callable");
  if (Array.isArray(exportsObject.inject) === false) fail("inject must be an array");
  else console.log(`inject list       ${exportsObject.inject.join(", ")}`);
}

console.log(failed ? "bundle check: FAILED" : "bundle check: OK");
process.exit(failed ? 1 : 0);
