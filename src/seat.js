/**
 * The composer seat: a DSH client plugin component that renders the
 * Codex-style <dsh-reasoning-slider> next to the official model chip and wires
 * it to the same model selection the official menu writes.
 *
 * Data comes from the client service `modelDirectories` (provided by
 * @deepseek-ai/dsh-client-ui-model-selection):
 *
 *   const directory = modelDirectories.directoryFor(sessionId)
 *   directory.load()                 -> loads the catalog (groups/models/reasoning)
 *   directory.store                  -> subscribable snapshot
 *      .current  = { provider, model, reasoningEffort? } | null
 *      .groups   = [{ id, models: [{ id, reasoning?: { defaultEffort?, efforts: [{ id, name, description? }] } }] }]
 *      .pending  = in-flight selection | null
 *      .error    = last failure message | null
 *   directory.select({ provider, model, reasoningEffort? }) -> Promise<Result>
 *
 * Everything degrades to "render nothing" if the host shape is different, so a
 * mismatch can never take the composer down with it.
 *
 * @module reasoning-slider/seat
 */
import react from "react";
import { REASONING_SLIDER_TAG } from "./reasoning-slider.js";

/** Dictionary namespace owned by this plugin. */
export const NS = "reasoningSlider";

/** Fallback copy; the registered dictionaries supply the localised versions. */
const COPY = {
  label: "推理等级",
  providerDefault: "默认",
  providerDefaultNote: "由供应商自定",
  failed: "切换推理等级失败",
};

/** A store that never changes, for a session whose directory cannot be resolved. */
const IDLE_STORE = {
  subscribe: () => () => {},
  getSnapshot: () => ({ current: null, groups: [], pending: null, error: null }),
};

/**
 * Tier names by position, so a four-tier model reads 轻度 / 中 / 高 / 极高 the way
 * the reference control does. Models with more tiers fall back to the adapter's
 * own effort names beyond the fourth.
 */
const TIER_LABELS = ["轻度", "中", "高", "极高"];

/** Translate with a literal fallback, tolerant of a missing dictionary. */
function say(t, key, fallback) {
  if (typeof t !== "function") return fallback;
  try {
    const value = t(key);
    return typeof value === "string" && value.length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

/** The model row the current selection points at, when the catalog has loaded. */
function modelOf(groups, current) {
  if (current === null || current === undefined || !Array.isArray(groups)) return undefined;
  const group = groups.find((candidate) => candidate?.id === current.provider);
  if (group === undefined) return undefined;
  return (group.models ?? []).find((candidate) => candidate?.id === current.model);
}

/** Display name of the model the selection points at (falls back to its id). */
function modelLabelOf(model, current) {
  if (model === undefined || model === null) return current?.model ?? "";
  return model.name ?? model.displayName ?? model.id ?? current?.model ?? "";
}

/**
 * Rows for the slider's own model picker: every model in the directory, with the
 * active one marked, so the card's subtitle line can switch models the way the
 * official chip does. `effort` carries that model's own default so the seat can
 * hand the host a complete selection.
 */
function modelsOf(groups, current) {
  const rows = [];
  for (const group of groups ?? []) {
    if (group === null || group === undefined) continue;
    for (const model of group.models ?? []) {
      if (model === null || model === undefined) continue;
      rows.push({
        provider: String(group.id ?? ""),
        providerLabel: group.name ?? group.id ?? "",
        model: String(model.id ?? ""),
        label: model.name ?? model.id ?? "",
        effort: model.reasoning?.defaultEffort,
        current: current !== null && current !== undefined
          && current.provider === group.id && current.model === model.id,
      });
    }
  }
  return rows;
}

/** Cheap equality so a re-render does not rebuild the picker's DOM. */
function sameModels(a, b) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => row.provider === b[index].provider
    && row.model === b[index].model
    && row.label === b[index].label
    && row.current === b[index].current);
}

/**
 * Slider stops for one model.
 *
 * The official menu offers "provider default" as the first choice only when the
 * adapter declares no default effort of its own — mirroring that keeps this
 * control interchangeable with the menu. Effort names are replaced by the
 * positional tier names above.
 */
function levelsOf(model, t) {
  const reasoning = model?.reasoning;
  if (reasoning === null || reasoning === undefined) return [];
  const levels = [];
  if (reasoning.defaultEffort === undefined) {
    levels.push({
      id: "",
      label: say(t, "effort.providerDefault", COPY.providerDefault),
      note: say(t, "effort.providerDefaultNote", COPY.providerDefaultNote),
    });
  }
  for (const [index, effort] of (reasoning.efforts ?? []).entries()) {
    if (effort === null || effort === undefined) continue;
    const id = String(effort.id ?? "");
    if (id === "") continue;
    levels.push({ id, label: TIER_LABELS[index] ?? effort.name ?? id, note: effort.description });
  }
  return levels;
}

/** True when two level lists describe the same stops. */
function sameLevels(left, right) {
  if (left.length !== right.length) return false;
  return left.every((level, index) => level.id === right[index].id && level.label === right[index].label && level.note === right[index].note);
}

/** Read a directory store without letting a throwing getter kill the seat. */
function readStore(store) {
  try {
    return store?.getSnapshot?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * The seat component.
 * @param props - injected by the slot registration (see `seatProps`).
 * @returns the mounted slider, or null when this session serves no levels.
 */
export function ReasoningSeat(props) {
  const { available, directory, load, select, sessionId, t, problem } = props;

  // The slot re-creates every callback prop on each render, so nothing below may
  // depend on a function identity. An effect keyed on `load` re-ran on every
  // render, asked the directory to load again, and looped until React aborted the
  // entry with error #185 ("maximum update depth exceeded").
  const directoryRef = react.useRef(directory);
  const loadRef = react.useRef(load);
  const selectRef = react.useRef(select);
  const tRef = react.useRef(t);
  directoryRef.current = directory;
  loadRef.current = load;
  selectRef.current = select;
  tRef.current = t;

  const [state, setState] = react.useState(() => readStore(directory));
  const hostRef = react.useRef(null);
  const elementRef = react.useRef(null);
  const levelsRef = react.useRef([]);
  const modelsRef = react.useRef([]);
  const targetRef = react.useRef(null);
  const loadedRef = react.useRef("");
  const valueRef = react.useRef("");
  const labelRef = react.useRef("");
  const flagsRef = react.useRef({ modelOnly: false, busy: false, available: false });

  const current = state?.current ?? null;
  const model = modelOf(state?.groups, current);
  const levels = levelsOf(model, t);
  const value = current?.reasoningEffort ?? model?.reasoning?.defaultEffort ?? "";
  const modelLabel = modelLabelOf(model, current);
  const models = modelsOf(state?.groups, current);
  const busy = (state?.pending ?? null) !== null;
  // This seat shadows the shipped model chip, so it always renders something:
  // the full control when the model has efforts, otherwise the model name and
  // its picker alone.
  const modelOnly = available !== true || levels.length < 2;

  // Latest values for the effects, none of which may depend on object identity.
  levelsRef.current = levels;
  modelsRef.current = models;
  targetRef.current = current === null ? null : { provider: current.provider, model: current.model };
  valueRef.current = value;
  labelRef.current = modelLabel;
  flagsRef.current = { modelOnly, busy, available: available === true };

  // Subscribe once per session and read imperatively, so a store that mints a
  // new snapshot object per call cannot loop the component.
  react.useEffect(() => {
    const store = directoryRef.current;
    if (store === undefined || store === null) return undefined;
    const read = () => setState(readStore(store));
    read();
    let unsubscribe;
    try {
      unsubscribe = store.subscribe(read);
    } catch {
      unsubscribe = undefined;
    }
    return () => {
      try {
        unsubscribe?.();
      } catch {
        // Unsubscribing is best effort.
      }
    };
  }, [sessionId]);

  // Ask the directory to load at most once per session — never once per render.
  react.useEffect(() => {
    if (available !== true) return;
    if (loadedRef.current === sessionId) return;
    loadedRef.current = sessionId;
    try {
      loadRef.current?.();
    } catch {
      // A directory whose load rejects reports through store.error instead.
    }
  }, [available, sessionId]);

  react.useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    const element = host.ownerDocument.createElement(REASONING_SLIDER_TAG);
    element.setAttribute("compact", "");
    element.setAttribute("label", say(tRef.current, "label", COPY.label));
    // Composer seat: the reference proportions (thumb = 1.57 × track) scaled down
    // to a 28px composer row, and a narrower capsule than the card form.
    element.style.setProperty("--rs-track-width", "118px");
    element.style.setProperty("--rs-track-height", "18px");
    element.style.setProperty("--rs-thumb-size", "28px");
    element.style.setProperty("--rs-dot-size", "3.5px");
    const onChange = (event) => {
      const target = targetRef.current;
      if (target === null) return;
      const id = String(event?.detail?.id ?? "");
      const level = levelsRef.current.find((candidate) => candidate.id === id);
      try {
        const result = selectRef.current({
          provider: target.provider,
          model: target.model,
          ...(level === undefined || level.id === "" ? {} : { reasoningEffort: level.id }),
        });
        if (result !== null && typeof result?.catch === "function") result.catch(() => {});
      } catch {
        // A host refusal surfaces through store.error; never throw into the slot.
      }
    };
    element.addEventListener("reasoning-change", onChange);
    const onModelChange = (event) => {
      const provider = String(event?.detail?.provider ?? "");
      const modelId = String(event?.detail?.model ?? "");
      if (provider === "" || modelId === "") return;
      const row = modelsRef.current.find((entry) => entry.provider === provider && entry.model === modelId);
      try {
        // Mirror the official chip: switching models adopts that model's own
        // default effort when it declares one, otherwise the provider decides.
        const result = selectRef.current({
          provider,
          model: modelId,
          ...(row?.effort === undefined ? {} : { reasoningEffort: row.effort }),
        });
        if (result !== null && typeof result?.catch === "function") result.catch(() => {});
      } catch {
        // A host refusal surfaces through store.error; never throw into the slot.
      }
    };
    element.addEventListener("reasoning-model-change", onModelChange);
    host.appendChild(element);
    elementRef.current = element;
    return () => {
      element.removeEventListener("reasoning-change", onChange);
      element.removeEventListener("reasoning-model-change", onModelChange);
      element.remove();
      elementRef.current = null;
    };
  }, [available, sessionId]);

  // One primitive signature drives the sync effect, so the arrays rebuilt on
  // every render never re-trigger it.
  const signature = [
    levels.map((level) => `${level.id}\u0001${level.label}\u0001${level.note ?? ""}`).join("\u0002"),
    models.map((row) => `${row.provider}/${row.model}${row.current === true ? "*" : ""}`).join("\u0002"),
    value,
    modelLabel,
    busy ? "busy" : "idle",
    available === true ? "on" : "off",
    modelOnly ? "model-only" : "full",
  ].join("\u0003");

  react.useEffect(() => {
    const element = elementRef.current;
    if (element === null) return;
    if (!sameLevels(element.levels ?? [], levelsRef.current)) element.levels = levelsRef.current;
    if (!sameModels(element.models ?? [], modelsRef.current)) element.models = modelsRef.current;
    element.value = valueRef.current;
    // The card form shows the tier name on the headline and the model underneath.
    element.setAttribute("subtitle", labelRef.current);
    element.toggleAttribute("model-only", flagsRef.current.modelOnly);
    element.toggleAttribute("busy", flagsRef.current.busy);
    element.toggleAttribute("disabled", flagsRef.current.available === false || flagsRef.current.busy);
  }, [signature]);

  return react.createElement("div", {
    className: "dsh-rs-seat",
    ref: hostRef,
    "data-state": state?.error ? "error" : busy ? "busy" : "idle",
    // Diagnostics: why this seat is showing what it shows. Visible in DevTools
    // and read by tools/probe-app.mjs, so a blank control is never a mystery.
    "data-session": String(sessionId ?? ""),
    "data-available": available === true ? "yes" : "no",
    "data-groups": String(Array.isArray(state?.groups) ? state.groups.length : -1),
    "data-levels": String(levels.length),
    ...(problem ? { "data-problem": problem, title: problem } : {}),
    ...(state?.error ? { "data-error": "", title: state.error } : {}),
  });
}

/** The client plugin body: register the seat into the composer's trailing list. */
export function apply(ctx) {
  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, {
        zh: {
          label: "推理等级",
          "effort.providerDefault": "默认",
          "effort.providerDefaultNote": "由供应商自定",
          failed: "切换推理等级失败",
        },
        en: {
          label: "Reasoning",
          "effort.providerDefault": "Default",
          "effort.providerDefaultNote": "Provider decides",
          failed: "Could not switch reasoning effort",
        },
      });
    } catch {
      return () => {};
    }
  }, "reasoning-slider: dictionaries");

  injectStyle();

  ctx.inject(["slots", "modelDirectories", "sessions"], (scope) => {
    const models = scope.modelDirectories;
    const sessions = scope.sessions;
    const props = (sessionId) => {
      // Each step is guarded on its own so one unavailable API cannot blank the
      // whole seat, and whatever fails is reported on the seat element instead of
      // disappearing into a silent catch.
      let problem = "";
      let directory = null;
      try {
        directory = models.directoryFor(sessionId);
      } catch (error) {
        problem = `directoryFor: ${error?.message ?? error}`;
      }
      let available = true;
      try {
        available = sessions.subagentAddress(sessionId) === undefined;
      } catch (error) {
        problem = problem === "" ? `subagentAddress: ${error?.message ?? error}` : problem;
        available = true; // Treat an unknown session as a normal one, not a blanked seat.
      }
      if (directory === null || directory === undefined) {
        return {
          sessionId,
          available: false,
          directory: IDLE_STORE,
          load: () => {},
          select: () => Promise.resolve(undefined),
          problem,
        };
      }
      return {
        sessionId,
        available,
        directory: directory.store,
        load: () => {
          try {
            if (available) directory.load().catch(() => {});
          } catch {
            // A directory that refuses to load reports through store.error.
          }
        },
        select: (selection) => (available ? directory.select(selection) : Promise.resolve(undefined)),
        problem,
      };
    };

    // Seat placement, switchable in one line:
    //   "replace" — shadow the shipped model seat (`priority: -1`) so the slider
    //               IS the composer's model control, matching the reference card;
    //               falls back to "beside" if the slot refuses the shadow.
    //   "beside"  — leave the shipped chip alone and add the slider to the
    //               composer's trailing list (`conversation.input.right`).
    // If a restart leaves the composer without any model control, switch to
    // "beside" and rebuild: node build.mjs
    const SEAT_MODE = "replace";
    const registerSeat = (name, options) => scope.slots.register({
      name,
      locale: NS,
      inject: props,
      ...options,
    }, ReasoningSeat);

    try {
      scope.slots.inject("conversation.input.model", () => {
        if (SEAT_MODE === "beside") {
          try {
            return registerSeat("conversation.input.right");
          } catch {
            return () => {};
          }
        }
        try {
          // Take over the composer's model seat: the shipped ModelSelect registers
          // at the default priority, so this control lands where the model + effort
          // chip used to be. The shipped picker is not lost — this component
          // carries its own model menu.
          return registerSeat("conversation.input.model", { priority: -1 });
        } catch {
          // If a future build refuses the shadow (or claims the same priority),
          // fall back to sitting beside the shipped chip instead of vanishing.
          try {
            return registerSeat("conversation.input.right");
          } catch {
            return () => {};
          }
        }
      });
    } catch {
      // A build whose slot registry rejects the name must still boot; the slider
      // simply does not mount. Never let activation failure abort web boot.
    }
  });
}

/**
 * Required client services.
 *
 * `remote` and `remote.session` are not optional extras: the `modelDirectories`
 * service resolves sessions through `ctx.remote.session` and its guard rejects
 * the read with "cannot get property remote.session without inject" unless the
 * consuming plugin declares them too. Without this the seat mounts but stays
 * empty (the failure is caught and reported on the seat element).
 */
export const inject = ["slots", "locale", "sessions", "modelDirectories", "remote", "remote.session"];

/** One document-level stylesheet for the seat wrapper (the slider styles itself). */
function injectStyle() {
  try {
    if (typeof document === "undefined" || document.head === null) return;
    const id = "reasoning-slider/seat.css";
    if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return;
    const style = document.createElement("style");
    style.dataset.pluginCss = id;
    style.textContent = [
      ".dsh-rs-seat{display:inline-flex;align-items:center;gap:6px;min-width:0}",
      '.dsh-rs-seat[data-error]::after{content:"";width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-danger-primary,#b42318);flex:none}',
      ".dsh-rs-seat[data-state=busy] .dsh-rs-seat-meta{opacity:.55}",
    ].join("");
    document.head.appendChild(style);
  } catch {
    // Styling the seat wrapper is cosmetic; never let it break activation.
  }
}
