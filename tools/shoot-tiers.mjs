// Capture real in-app screenshots of the reasoning slider: one close-up per tier,
// plus the composer with the model menu open. Drives the running DSH web UI over
// the Chrome DevTools Protocol, so the images show the shipped plugin, not a demo.
//
// usage: node tools/shoot-tiers.mjs <url> <outDir> [chromeDebugPort]
//
// Chrome must already run with --remote-debugging-port=<port> (default 9333).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [url, outDir, portRaw, prefixRaw] = process.argv.slice(2);
const port = Number(portRaw ?? 9333);
const prefix = prefixRaw ?? "app-tier";
mkdirSync(outDir, { recursive: true });

async function connect() {
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
  return { send, problems, close: () => socket.close() };
}

const evaluate = async (client, expression) => {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: false });
  return result.result?.value;
};

const client = await connect();
await client.send("Runtime.enable");
await client.send("Page.enable");
await client.send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, 18000));

const seat = await evaluate(client, `(() => {
  const el = document.querySelector("dsh-reasoning-slider");
  if (el === null) return null;
  el.scrollIntoView({ block: "center" });
  const rect = el.getBoundingClientRect();
  const host = document.querySelector(".dsh-rs-seat")?.getBoundingClientRect();
  return {
    levels: (el.levels || []).map((l) => l.label),
    value: el.value,
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    hostX: host?.x ?? rect.x, hostY: host?.y ?? rect.y, hostW: host?.width ?? rect.width, hostH: host?.height ?? rect.height,
  };
})()`);
if (seat === null) throw new Error("no dsh-reasoning-slider on the page; is the plugin active for this profile?");
console.log("levels:", seat.levels.join(" / "));

/** Screenshot the composer row around the seat, at 3x for a crisp close-up. */
async function shoot(name, padX = 26, padY = 14, scale = 3) {
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: {
      x: Math.max(0, seat.hostX - padX),
      y: Math.max(0, seat.hostY - padY),
      width: seat.hostW + padX * 2,
      height: seat.hostH + padY * 2,
      scale,
    },
  });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log(`  ${name}`);
}

const count = seat.levels.length;
for (let index = 0; index < count; index += 1) {
  const label = seat.levels[index];
  await evaluate(client, `document.querySelector("dsh-reasoning-slider").select(${index})`);
  await new Promise((resolve) => setTimeout(resolve, 1400));
  await shoot(`${prefix}-${index}-${label}.png`);
}

// Composer with the model menu open (click the model line inside the shadow root).
await evaluate(client, `document.querySelector("dsh-reasoning-slider").shadowRoot.querySelector(".headline .sub")?.click()`);
await new Promise((resolve) => setTimeout(resolve, 900));
const full = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(join(outDir, `${prefix === "app-tier" ? "app-model-menu" : `${prefix}-menu`}.png`), Buffer.from(full.data, "base64"));
console.log(`  ${prefix === "app-tier" ? "app-model-menu" : `${prefix}-menu`}.png (full page)`);

console.log(`\nconsole exceptions: ${client.problems.length}`);
for (const problem of client.problems.slice(0, 5)) console.log("  " + String(problem).split("\n")[0]);
client.close();
