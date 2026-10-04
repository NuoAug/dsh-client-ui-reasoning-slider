// Capture the model-switch flow inside the slider: menu open → highlight moved to
// another model → after the selection lands. Real instance, driven over CDP.
//
// usage: node tools/shoot-switch.mjs <url> <outDir> [prefix] [chromeDebugPort]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [url, outDir, prefixRaw, portRaw] = process.argv.slice(2);
const prefix = prefixRaw ?? "app-switch";
const port = Number(portRaw ?? 9333);
mkdirSync(outDir, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((entry) => entry.type === "page");
if (page === undefined) throw new Error("no page target; start Chrome with --remote-debugging-port");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 1;
const pending = new Map();
const problems = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: false });
  return result.result?.value;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, 18000));

// A first-run "预览版说明" modal sits over the composer; dismiss it if present.
const dismissed = await evaluate(`(() => {
  const hit = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim().startsWith("继续"));
  if (hit === undefined) return "no-modal";
  hit.click();
  return "dismissed";
})()`);
console.log(`welcome modal: ${dismissed}`);
await new Promise((resolve) => setTimeout(resolve, 1500));

const seat = await evaluate(`(() => {
  const el = document.querySelector("dsh-reasoning-slider");
  if (el === null) return null;
  el.scrollIntoView({ block: "center" });
  const host = document.querySelector(".dsh-rs-seat").getBoundingClientRect();
  const el2 = el.getBoundingClientRect();
  return { x: host.x, y: host.y, w: host.width, h: host.height, levels: (el.levels || []).length };
})()`);
if (seat === null) throw new Error("no dsh-reasoning-slider on the page");

/**
 * Crop the whole composer row plus the menu that hangs below it: the menu is
 * centred on the model line, so the box starts well left of the seat.
 */
async function shoot(name, padBottom = 300, scale = 2) {
  const left = Math.max(0, seat.x - 300);
  const top = Math.max(0, seat.y - 34);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: {
      x: left,
      y: top,
      width: Math.min(1400, seat.x + seat.w + 80 - left),
      height: seat.h + 34 + padBottom,
      scale,
    },
  });
  writeFileSync(join(outDir, name), Buffer.from(shot.data, "base64"));
  console.log(`  ${name}`);
}

/** Poll an in-page predicate until it is true (the seat fills in asynchronously). */
async function waitFor(expression, label, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression) === true) {
      console.log(`  ready: ${label}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const sub = `document.querySelector("dsh-reasoning-slider").shadowRoot.querySelector(".headline .sub")`;

// 1) wait until the model line is populated and enabled, then open the menu
await waitFor(`(() => { const b = ${sub}; return b !== null && b !== undefined && b.disabled === false; })()`, "model line enabled");

// Baseline: pick the Flash row first, so the switch below has a visibly different
// target (a repeated run would otherwise start from whatever the last run chose).
await evaluate(`${sub}.click()`);
await waitFor(`document.querySelector("dsh-reasoning-slider").hasAttribute("data-menu") === true`, "menu open");
const baseline = await evaluate(`(() => {
  const rows = [...document.querySelector("dsh-reasoning-slider").shadowRoot.querySelectorAll(".menu button.item")];
  const flash = rows.find((row) => row.textContent.includes("V41-Flash"));
  if (flash === undefined) return null;
  flash.click();
  return flash.textContent.replace("✓", "").trim();
})()`);
console.log(`baseline model: ${baseline}`);
await new Promise((resolve) => setTimeout(resolve, 3500));

// 2) open again and move the highlight onto a row that is not the current model
await evaluate(`${sub}.click()`);
await waitFor(`document.querySelector("dsh-reasoning-slider").hasAttribute("data-menu") === true`, "menu open");
for (let step = 0; step < 4; step += 1) {
  const landed = await evaluate(`(() => {
    const root = document.querySelector("dsh-reasoning-slider").shadowRoot;
    const active = root.querySelector(".menu button.item[data-active]");
    return active !== null && active.getAttribute("aria-selected") !== "true";
  })()`);
  if (landed === true) break;
  await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))`);
  await new Promise((resolve) => setTimeout(resolve, 350));
}
const state = await evaluate(`(() => {
  const root = document.querySelector("dsh-reasoning-slider").shadowRoot;
  const active = root.querySelector(".menu button.item[data-active]");
  const current = root.querySelector('.menu button.item[aria-selected="true"]');
  return {
    active: active?.textContent?.replace("✓", "").trim() ?? null,
    current: current?.textContent?.replace("✓", "").trim() ?? null,
    items: root.querySelectorAll(".menu button.item").length,
  };
})()`);
console.log(`menu: ${state.items} 项 · 当前 ${state.current} · 高亮 ${state.active}`);
await shoot(`${prefix}-open.png`, 300, 2);

// 3) commit the highlighted row and let the host selection land
await evaluate(`document.querySelector("dsh-reasoning-slider").shadowRoot.querySelector(".menu button.item[data-active]").click()`);
await new Promise((resolve) => setTimeout(resolve, 3500));
const after = await evaluate(`(() => {
  const el = document.querySelector("dsh-reasoning-slider");
  const root = el.shadowRoot;
  return {
    subtitle: root.querySelector(".headline .subtext")?.textContent ?? null,
    tier: root.querySelector(".headline .title")?.textContent ?? null,
    value: el.value,
    levels: (el.levels || []).map((l) => l.label),
    seatState: document.querySelector(".dsh-rs-seat")?.getAttribute("data-state") ?? null,
    groups: document.querySelector(".dsh-rs-seat")?.getAttribute("data-groups") ?? null,
  };
})()`);
console.log(`after switch: ${after.subtitle} · ${after.tier} · value=${after.value} · levels=${after.levels.join("/")} · state=${after.seatState} · groups=${after.groups}`);
await shoot(`${prefix}-after.png`, 70, 2);

console.log(`\nconsole exceptions: ${problems.length}`);
for (const problem of problems.slice(0, 5)) console.log("  " + String(problem).split("\n")[0]);
socket.close();
