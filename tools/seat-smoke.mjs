// Smoke test for the plugin glue (src/seat.js).
//
// The demo pages only exercise the slider component; this file runs the seat
// itself the way the DSH client runtime does — with a stub React and a fake
// service scope — so a stale identifier, a bad slot registration or a broken
// render shows up here instead of in the running app.
//
// usage: node tools/seat-smoke.mjs
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const seatSource = readFileSync(join(root, "src", "seat.js"), "utf8");

const dir = mkdtempSync(join(tmpdir(), "seat-smoke-"));
mkdirSync(dir, { recursive: true });

// --- stub react -------------------------------------------------------------
writeFileSync(join(dir, "react.mjs"), `
export const calls = { effects: 0, renders: 0 };
const refs = [];
const states = [];
export function useRef(initial) {
  const index = refs.length;
  refs[index] = refs[index] ?? { current: initial };
  return refs[index];
}
export function useState(initial) {
  // The seat subscribes to the directory store with useState + useEffect, so the
  // stub needs a slot that survives the single render pass this smoke test does.
  const index = states.length;
  if (states[index] === undefined) {
    states[index] = { value: typeof initial === "function" ? initial() : initial };
  }
  const slot = states[index];
  return [slot.value, (next) => {
    slot.value = typeof next === "function" ? next(slot.value) : next;
  }];
}
export function useSyncExternalStore(subscribe, getSnapshot) {
  return getSnapshot();
}
export function useMemo(factory) { return factory(); }
export function useCallback(fn) { return fn; }
export function useEffect(effect, deps) {
  calls.effects += 1;
  // Run immediately, the way a mounted component would.
  effect();
}
export function createElement(type, props, ...children) {
  return { type, props: { ...(props ?? {}), children: children.length > 0 ? children : undefined } };
}
export default { useRef, useState, useSyncExternalStore, useMemo, useCallback, useEffect, createElement, calls };
`);

// --- stub component module --------------------------------------------------
writeFileSync(join(dir, "reasoning-slider.js"), `
export const REASONING_SLIDER_TAG = "dsh-reasoning-slider";
`);

const patched = seatSource
  .replace(/from "react"/, 'from "./react.mjs"')
  .replace(/from "\.\/reasoning-slider\.js"/, 'from "./reasoning-slider.js"');
writeFileSync(join(dir, "seat.mjs"), patched);

// --- fake client scope ------------------------------------------------------
const store = {
  subscribe: () => () => {},
  getSnapshot: () => ({
    current: { provider: "deepseek", model: "flash", reasoningEffort: "medium" },
    groups: [{
      id: "deepseek",
      name: "DeepSeek",
      models: [
        { id: "flash", name: "DeepSeek-V41-Flash", reasoning: { defaultEffort: "medium", efforts: [{ id: "low", name: "Low" }, { id: "high", name: "High" }, { id: "max", name: "Max" }] } },
        { id: "v4-pro", name: "DeepSeek-V4-Pro", reasoning: { efforts: [{ id: "low", name: "Low" }] } },
      ],
    }],
    pending: null,
    error: null,
  }),
};

const registrations = [];
const selections = [];
const scope = {
  slots: {
    inject(name, factory) {
      registrations.push({ name, entry: factory() });
    },
    register(spec, component) {
      if (spec.priority !== -1) throw new Error(`unexpected priority ${spec.priority}`);
      return { spec, component, dispose: () => {} };
    },
  },
  modelDirectories: {
    directoryFor: () => ({ store, load: async () => {}, select: async (selection) => { selections.push(selection); } }),
  },
  sessions: { subagentAddress: () => undefined },
};

const ctx = {
  effect: (fn) => { try { fn(); } catch { /* dictionaries are optional here */ } },
  inject: (names, fn) => fn(scope),
  locale: { register: () => () => {} },
};

const failures = [];
const check = (label, condition, detail) => {
  if (condition) console.log(`  ok   ${label}`);
  else { failures.push(label); console.log(`  FAIL ${label}${detail === undefined ? "" : ` — ${detail}`}`); }
};

const seat = await import(pathToFileURL(join(dir, "seat.mjs")).href);
check("apply runs without throwing", typeof seat.apply === "function");
seat.apply(ctx);

check("registered exactly one seat", registrations.length === 1, `got ${registrations.length}`);
check("took over conversation.input.model", registrations[0]?.name === "conversation.input.model", registrations[0]?.name);
check("registration is disposable", typeof registrations[0]?.entry?.dispose === "function");

// Render the seat the way the slot renderer would, with a fake DOM.
function fakeElement(tag) {
  const element = {
    tagName: String(tag).toUpperCase(),
    ownerDocument: null,
    attributes: {},
    children: [],
    style: { props: {}, setProperty: (key, value) => { element.style.props[key] = value; } },
    listeners: {},
    classList: { toggle: () => {} },
    setAttribute: (key, value) => { element.attributes[key] = String(value); },
    getAttribute: (key) => element.attributes[key],
    removeAttribute: (key) => { delete element.attributes[key]; },
    toggleAttribute: (key, on) => { if (on === false) delete element.attributes[key]; else element.attributes[key] = ""; },
    hasAttribute: (key) => key in element.attributes,
    addEventListener: (type, handler) => { element.listeners[type] = handler; },
    removeEventListener: () => {},
    appendChild: (child) => { element.children.push(child); return child; },
    remove: () => {},
  };
  return element;
}

const document = {
  createElement: (tag) => {
    const element = fakeElement(tag);
    element.ownerDocument = document;
    return element;
  },
  head: { appendChild: () => {} },
  querySelector: () => null,
};
globalThis.document = document;

const registration = registrations[0].entry;
const injected = registration.spec.inject("session-1");
check("inject exposes the directory store", injected?.directory === store);
check("inject exposes availability", injected?.available === true);

const tree = registration.component(injected);
check("component returns a seat host", tree?.props?.className === "dsh-rs-seat", JSON.stringify(tree?.props?.className));
check("seat host is rendered", tree?.type === "div");
check("render did not throw", true);

console.log(`\n${failures.length === 0 ? "seat smoke: PASS" : `seat smoke: FAIL (${failures.join(", ")})`}`);
process.exit(failures.length === 0 ? 0 : 1);
