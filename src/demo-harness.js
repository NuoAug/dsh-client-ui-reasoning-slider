/**
 * Demo harness for the reasoning slider (no React, no build step).
 *
 * Composed into demo.html by build.mjs, so you can just double-click that file:
 * inline module scripts run from file://, external ones do not.
 *
 * It fakes the three states a model can be in — several efforts with a declared
 * default, a provider-default stop, and no reasoning at all — plus the busy and
 * failed selection states the real host produces.
 */
const TAG = "dsh-reasoning-slider";

const CATALOG = {
  "flash": {
    label: "DeepSeek-V41-Flash",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    reasoning: {
      defaultEffort: "medium",
      efforts: [
        { id: "minimal", name: "Minimal", description: "最快，几乎不推理" },
        { id: "low", name: "Low", description: "轻量推理" },
        { id: "medium", name: "Medium", description: "平衡" },
        { id: "high", name: "High", description: "深推理，慢但更稳" },
      ],
    },
  },
  "v4-pro": {
    label: "DeepSeek-V4-Pro",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    reasoning: {
      efforts: [
        { id: "low", name: "Low", description: "轻量推理" },
        { id: "medium", name: "Medium", description: "平衡" },
        { id: "high", name: "High", description: "深推理" },
      ],
    },
  },
  "codex": {
    label: "GPT-5.6 Sol",
    provider: "openai",
    providerLabel: "OpenAI",
    reasoning: {
      defaultEffort: "low",
      efforts: [
        { id: "off", name: "Off", description: "不推理" },
        { id: "low", name: "Low", description: "轻量推理" },
        { id: "high", name: "High", description: "更深推理 · 轻微火花" },
        { id: "max", name: "Max", description: "最高档 · 渐变火花" },
      ],
    },
  },
  "plain": {
    label: "gpt-oss-20b",
    provider: "local",
    providerLabel: "本地",
    reasoning: null,
  },
};

const state = {
  model: "flash",
  effort: "medium",
  busy: false,
  disabled: false,
  expanded: false,
  error: null,
};

const el = (selector) => document.querySelector(selector);
const log = el("#log");

/**
 * Positional tier names — the same mapping the DSH seat applies to a model's
 * effort list (Off/Low/High/Max → 轻度/中/高/极高).
 */
const TIER_LABELS = ["轻度", "中", "高", "极高"];

function note(text) {
  const line = document.createElement("div");
  line.className = "log-line";
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  line.innerHTML = `<span class="log-time">${time}</span><span>${text}</span>`;
  log.prepend(line);
  while (log.children.length > 40) log.lastElementChild.remove();
}

/** The stop list for the active model — the same shape the plugin feeds the slider. */
function levelsFor() {
  const model = CATALOG[state.model];
  const reasoning = model.reasoning;
  if (reasoning === null) return [];
  const levels = [];
  if (reasoning.defaultEffort === undefined) {
    levels.push({ id: "", label: "默认", note: "由供应商自定" });
  }
  for (const [index, effort] of reasoning.efforts.entries()) levels.push({
    id: effort.id,
    label: TIER_LABELS[index] ?? effort.name ?? effort.id,
    note: effort.description,
  });
  return levels;
}

/** Every slider on the page (both theme panes share one state). */
function sliders() {
  return [...document.querySelectorAll(TAG)];
}

/** Model-menu rows for the picker — the shape the plugin hands to the slider. */
function modelsFor() {
  return Object.entries(CATALOG).map(([id, model]) => ({
    provider: model.provider ?? "deepseek",
    providerLabel: model.providerLabel ?? "DeepSeek",
    model: id,
    label: model.label,
    current: id === state.model,
  }));
}

function sync() {
  const levels = levelsFor();
  const model = CATALOG[state.model];
  const effective = state.effort === "" ? "默认" : state.effort;
  const models = modelsFor();
  for (const slider of sliders()) {
    slider.levels = levels;
    slider.value = state.effort;
    slider.subtitle = model.label;
    slider.models = models;
    slider.toggleAttribute("busy", state.busy);
    slider.toggleAttribute("disabled", state.disabled);
    slider.toggleAttribute("expanded", state.expanded);
  }
  el("#readout").textContent = `${model.label} · ${effective}`;
  el("#spec-model").textContent = state.model;
  el("#spec-stops").textContent = String(levels.length);
  el("#spec-default").textContent = model.reasoning?.defaultEffort ?? "—";
  el("#spec-render").textContent = levels.length >= 2 ? "显示滑条" : "隐藏（无推理等级）";
  for (const button of document.querySelectorAll("[data-model]")) {
    button.classList.toggle("on", button.dataset.model === state.model);
  }
  for (const button of document.querySelectorAll("[data-toggle]")) {
    const key = button.dataset.toggle;
    button.classList.toggle("on", Boolean(state[key]));
  }
  el("#status").textContent = state.error ?? (state.busy ? "selecting…" : "idle");
  el("#status").dataset.kind = state.error ? "error" : state.busy ? "busy" : "idle";
}

function commit(id) {
  if (state.busy || state.disabled) return;
  const levels = levelsFor();
  const level = levels.find((candidate) => candidate.id === id);
  note(`reasoning-change → id=${JSON.stringify(id)} label=${JSON.stringify(level?.label ?? "")} index=${levels.indexOf(level)}`);
  state.effort = id;
  state.error = null;
  state.busy = true;
  sync();
  // Imitate the host round trip: the thumb pulses until the selection settles.
  window.setTimeout(() => {
    state.busy = false;
    if (Math.random() < 0.12) state.error = "session/writer-held: 该会话正在被其它写入占用";
    sync();
  }, 520);
}

for (const slider of sliders()) {
  slider.addEventListener("reasoning-change", (event) => commit(String(event.detail.id ?? "")));
  slider.addEventListener("reasoning-model-change", (event) => {
    const id = String(event.detail.model ?? "");
    const model = CATALOG[id];
    if (model === undefined) return;
    state.model = id;
    state.effort = model.reasoning === null
      ? ""
      : (model.reasoning.defaultEffort ?? model.reasoning.efforts[0].id);
    state.error = null;
    note(`滑块内切换模型 → ${model.label}（默认档位 ${state.effort || "—"}）`);
    sync();
  });
}

for (const button of document.querySelectorAll("[data-model]")) {
  button.addEventListener("click", () => {
    state.model = button.dataset.model;
    const model = CATALOG[state.model];
    state.effort = model.reasoning === null
      ? ""
      : (model.reasoning.defaultEffort ?? model.reasoning.efforts[0].id);
    note(`模型切换到 ${model.label}（默认档位 ${state.effort || "—"}）`);
    sync();
  });
}

for (const button of document.querySelectorAll("[data-toggle]")) {
  button.addEventListener("click", () => {
    const key = button.dataset.toggle;
    state[key] = !state[key];
    note(`switch ${key} = ${state[key]}`);
    sync();
  });
}

el("#fail").addEventListener("click", () => {
  state.error = "session/writer-held: 该会话正在被其它写入占用";
  note("模拟一次宿主拒绝");
  sync();
});

el("#clear").addEventListener("click", () => {
  state.error = null;
  log.replaceChildren();
  note("已清空");
  sync();
});

note("demo 就绪：拖动、点按，或用 ←/→/Home/End/1-4 操作滑条");
sync();
