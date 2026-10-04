// Drive the live DSH web UI over the Chrome DevTools Protocol and report whether
// the reasoning-slider client plugin really activated and mounted.
//
// usage: node tools/probe-app.mjs <url> <screenshot-out.png> [waitMs]
//
// Uses Node's built-in fetch + WebSocket (no dependencies). Chrome must already
// be running with --remote-debugging-port=9333.
import { writeFileSync } from "node:fs";

const [url, shotPath, waitMsRaw, clickText, preShotJs] = process.argv.slice(2);
const waitMs = Number(waitMsRaw ?? 15000);

/** Minimal CDP client: one socket, id-matched replies, event fan-out. */
async function connect() {
  const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  const page = targets.find((entry) => entry.type === "page");
  if (page === undefined) throw new Error("no page target; is Chrome running with --remote-debugging-port=9333?");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const events = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    events.push(message);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, events, close: () => socket.close() };
}

const client = await connect();
await client.send("Runtime.enable");
await client.send("Log.enable");
await client.send("Page.enable");
await client.send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, waitMs));

// Optionally open a real session first: the composer's model seat only receives a
// working directory once a session exists, so the welcome screen shows an empty
// control even when the plugin is healthy.
if (clickText !== undefined && clickText !== "") {
  const click = `(() => {
    const wanted = ${JSON.stringify(clickText)};
    const candidates = [...document.querySelectorAll("button,[role=button],a,[role=option]")]
      .filter((n) => (n.textContent || "").trim().startsWith(wanted) && n.offsetParent !== null)
      // The outermost match is a container that swallows the click; take the
      // shortest label, which is the innermost real control.
      .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    if (candidates.length === 0) return "not-found";
    const hit = candidates[0];
    hit.click();
    return "clicked<" + hit.tagName.toLowerCase() + ">:" + (hit.textContent || "").trim().slice(0, 30);
  })()`;
  const clicked = await client.send("Runtime.evaluate", { expression: click, returnByValue: true });
  console.log(`click "${clickText}" -> ${JSON.stringify(clicked.result.value)}`);
  await new Promise((resolve) => setTimeout(resolve, 6000));
}

const probe = `(() => {
  const seats = document.querySelectorAll(".dsh-rs-seat").length;
  const sliders = document.querySelectorAll("dsh-reasoning-slider").length;
  const defined = customElements.get("dsh-reasoning-slider") !== undefined;
  const seatHtml = seats > 0 ? document.querySelector(".dsh-rs-seat").outerHTML.slice(0, 300) : null;
  const shadowProbe = (() => {
    const el = document.querySelector("dsh-reasoning-slider");
    if (el === null || el.shadowRoot === null) return null;
    const title = el.shadowRoot.querySelector(".headline .title");
    const sub = el.shadowRoot.querySelector(".headline .subtext");
    const caption = el.shadowRoot.querySelector(".caption");
    return {
      levelIds: (el.levels || []).map((l) => l.id + "/" + l.label),
      modelRows: (el.models || []).map((m) => m.provider + ":" + m.model),
      value: el.value,
      title: title?.textContent ?? null,
      subtitle: sub?.textContent ?? null,
      caption: caption?.textContent ?? null,
      aria: el.getAttribute("aria-valuenow"),
      max: el.getAttribute("aria-valuemax"),
      tier: el.getAttribute("data-tier"),
      modelOnly: el.hasAttribute("model-only"),
    };
  })();
  const buttons = [...document.querySelectorAll("button,[role=button]")]
    .map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 30);
  return {
    defined, seats, sliders, seatHtml, shadowProbe, buttons,
    title: document.title,
    bodyText: (document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 400),
  };
})()`;

const result = await client.send("Runtime.evaluate", { expression: probe, returnByValue: true, awaitPromise: false });
console.log("=== 页面探测 ===");
console.log(JSON.stringify(result.result.value, null, 2));

const problems = client.events.filter((event) => event.method === "Runtime.exceptionThrown"
  || (event.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(event.params.type))
  || (event.method === "Log.entryAdded" && ["error", "warning"].includes(event.params.entry.level)));
console.log(`\n=== 控制台异常/警告 ${problems.length} 条 ===`);
for (const event of problems.slice(0, 20)) {
  if (event.method === "Runtime.exceptionThrown") console.log("EXCEPTION " + (event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text));
  else if (event.method === "Runtime.consoleAPICalled") console.log(`${event.params.type.toUpperCase()} ` + event.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
  else console.log(`${event.params.entry.level.toUpperCase()} ${event.params.entry.text}`.slice(0, 300));
}

if (preShotJs !== undefined && preShotJs !== "") {
  const acted = await client.send("Runtime.evaluate", { expression: preShotJs, returnByValue: true });
  console.log(`preShotJs -> ${JSON.stringify(acted.result?.value ?? acted.result?.type)}`);
  await new Promise((resolve) => setTimeout(resolve, 3500));
}

const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
console.log(`\nscreenshot -> ${shotPath}`);
client.close();
