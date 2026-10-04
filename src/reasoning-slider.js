/**
 * <dsh-reasoning-slider> — a Codex-style reasoning-effort slider, reproduced
 * from the reference card:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │                  高                          │   centred tier name
 *   │             DeepSeek-V41-Flash ›             │   centred subtitle (the model)
 *   │  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   capsule: fill, sparks, big thumb
 *   └──────────────────────────────────────────────┘
 *
 * Geometry that makes it read the same as the reference:
 *   · the thumb is ~1.57× the track height and its centre stops half a thumb
 *     from either end, so at the extremes the disc sits flush with the capsule;
 *   · the fill (and its gradient) spans the whole capsule and is revealed by a
 *     clip path up to the thumb's centre, so dot colours flip exactly where the
 *     disc passes and the gradient never compresses;
 *   · every stop carries a dot — gray on the rail, light once filled;
 *   · tiers: plain tiers fill solid blue, the second-highest warms toward violet
 *     with faint sparkles (`data-tier="soft"`), and the highest takes the full
 *     blue→violet gradient with bright sparkles (`data-tier="top"`).
 *
 * Framework-free custom element: no React, no build step, no dependencies.
 *
 * Properties
 *   levels : Array<{ id, label, note?, spark? }>   (id "" = provider default)
 *   value  : string   — the selected level id
 *   busy   : boolean  — a host selection is in flight
 *   compact: boolean  — one-line composer form (no card chrome)
 *   label  : string   — accessibility name
 *
 * Attributes: levels (JSON), value, busy, compact, expanded, disabled, variant,
 *   card, headline, subtitle, chevron, rowlabel, stretch, icons, spark-tier="off"
 *
 * Events
 *   "reasoning-change" — detail { id, label, index, level }
 *
 * @module reasoning-slider
 */

export const REASONING_SLIDER_TAG = "dsh-reasoning-slider";

/**
 * Sparkle fields, both deliberately fine-grained: many small dots read as dust,
 * a few big ones read as blobs. Sparkles in the top tier's field, and the even
 * finer field the tier below uses.
 */
const SPARK_COUNT = 76;
const FINE_COUNT = 104;

const STYLE = `
:host {
  /* tier colours */
  --rs-fill: #2b6cf6;
  --rs-stop-1: #2563ff;
  --rs-stop-2: #5b4bff;
  --rs-stop-3: #7c3aed;
  --rs-gradient: linear-gradient(90deg, var(--rs-stop-1) 0%, var(--rs-stop-2) 55%, var(--rs-stop-3) 100%);
  /* rail + stop dots */
  --rs-rail: #e9eaec;
  --rs-dot: #c9ccd2;
  --rs-dot-on: #ffffffb8;
  --rs-dot-size: 5px;
  /* one left→right flash sweep across the sparkle field */
  --rs-sweep: 1.9s;
  /* ink */
  --rs-ink: var(--dsw-alias-label-primary, #1f2329);
  --rs-ink-dim: var(--dsw-alias-label-tertiary, #8b9099);
  --rs-surface: var(--dsw-alias-bg-layer-3, #fff);
  --rs-hairline: var(--dsw-alias-border-l2, #ececf0);
  --rs-hover: color-mix(in srgb, var(--rs-ink) 8%, transparent);
  --rs-shadow: 0 12px 34px rgb(9 12 24 / .22);
  --rs-title: var(--rs-fill);
  --rs-thumb: #ffffff;
  --rs-ring: 0 2px 6px rgb(16 24 40 / .16), 0 1px 2px rgb(16 24 40 / .10);
  /* geometry — the reference proportions */
  --rs-track-height: 28px;
  --rs-thumb-size: 44px;
  --rs-pad: calc(var(--rs-thumb-size) / 2);
  --rs-pct: 0;
  --rs-thumb-x: calc(var(--rs-pad) + (100% - 2 * var(--rs-pad)) * var(--rs-pct) / 100);

  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: calc(var(--rs-thumb-size) + 6px);
  font: 400 13px/1 var(--dsw-font-family, ui-sans-serif, system-ui, "Segoe UI", sans-serif);
  color: var(--rs-ink);
  outline: none;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
:host([hidden]) { display: none; }
:host([disabled]) { opacity: .5; pointer-events: none; }
/* Composer form: the same proportions (thumb = 1.57 × track), scaled down to a
   28px composer row. The card form keeps the reference's full-size geometry. */
:host([compact]:not([card])) {
  --rs-track-height: 18px;
  --rs-thumb-size: 28px;
  --rs-dot-size: 3.5px;
  --rs-track-width: 118px;
}
/* When this control stands in for the shipped model chip, the compact row also
   carries the model trigger — otherwise switching models would be lost. */
:host([compact][data-model-chip]) .root { gap: 8px; }
:host([compact]) .meter { order: 1; }
:host([compact]) .stack { order: 2; }
:host([compact]) .caption { order: 3; }
:host([compact]) .headline { order: 4; }
:host([compact][data-model-chip]) .headline {
  display: inline-flex;
  flex-direction: row;
  gap: 0;
  padding: 0;
}
:host([compact]) .headline .title { display: none; }
:host([compact]) .headline .sub { font-size: 12.5px; max-width: 190px; }
.headline .sub .subtext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Model-only: this seat shadows the shipped model chip, so when there is no
   effort list to show (or the session cannot select) it must still render the
   model name and its picker rather than leave the composer without a control. */
:host([model-only]) .meter,
:host([model-only]) .stack { display: none; }
:host([model-only]) .headline {
  display: inline-flex;
  flex-direction: row;
  gap: 0;
  padding: 0;
}
:host([model-only]) .headline .title { display: none; }
:host([data-rail="dark"]) { --rs-rail: #ffffff1f; --rs-dot: #ffffff40; --rs-ink-dim: #a09d96; }
/* Dark theme: automatic when the shell marks its dark palette, or forced with
   the dark attribute (the demo pages use that). */
:host([dark]),
:host-context([data-ds-dark-theme]) {
  --rs-rail: #ffffff1f;
  --rs-dot: #ffffff3d;
  --rs-dot-on: #ffffffc4;
  --rs-ink: #faf9f5;
  --rs-ink-dim: #a09d96;
  --rs-thumb: #faf9f5;
  --rs-surface: #1c1b18;
  --rs-hairline: #ffffff1f;
  --rs-hover: color-mix(in srgb, #faf9f5 12%, transparent);
  --rs-shadow: 0 14px 36px rgb(0 0 0 / .5);
}
/* the top tier also tints its own headline (reference: Ultra renders violet) */
:host([data-tier="top"]) { --rs-title: var(--rs-stop-3); }

.root {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 3px 6px;
  border-radius: 16px;
  transition: background-color .16s ease;
}
:host(:focus-visible) .root { background: color-mix(in srgb, var(--rs-fill) 10%, transparent); }
:host(:focus-visible) .thumb { box-shadow: var(--rs-ring), 0 0 0 3px color-mix(in srgb, var(--rs-fill) 30%, transparent); }

/* ============================ card form ============================ */
:host([card]) {
  display: block;
  width: 100%;
}
:host([card]) .root {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto auto;
  align-items: start;
  gap: 0;
  width: 100%;
  padding: 14px 16px 16px;
  border-radius: 16px;
  background: var(--rs-surface);
  border: 1px solid var(--rs-hairline);
  box-shadow: 0 1px 2px rgb(16 24 40 / .05);
}
:host([card]) .meter,
:host([card]) .caption,
:host([card]) .row,
:host([card]) .tip { display: none; }
:host([card]) .stack { display: contents; }
:host([card]) .headline {
  grid-column: 1;
  grid-row: 1;
  justify-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 2px 12px 3px;
  border-radius: 11px;
}
/* Only the model row is highlighted — it is the clickable affordance, and the
   tier name above must not read as part of it. */
:host([card]) .headline .title { font-size: 16px; font-weight: 700; line-height: 1.25; letter-spacing: .01em; color: var(--rs-title); }
:host([card]) .headline .sub { font-size: 13px; line-height: 1.3; }

/* ---- the model line doubles as the model picker trigger ---- */
.headline .sub {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  margin: 0 -2px;
  border: 0;
  border-radius: 9px;
  /* Always tinted: this is the row that switches models, so the highlight marks
     it as the control rather than appearing only under the pointer. */
  background: color-mix(in srgb, var(--rs-ink) 7%, transparent);
  font: inherit;
  font-size: 12.5px;
  color: var(--rs-ink-dim);
  cursor: pointer;
  transition: background-color .14s ease, color .14s ease;
}
.headline .sub:hover,
:host([data-menu]) .headline .sub { background: color-mix(in srgb, var(--rs-ink) 13%, transparent); color: var(--rs-ink); }
.headline .sub[disabled] { background: transparent; cursor: default; }
.headline .sub[disabled]:hover { color: var(--rs-ink-dim); }
.headline .sub .chev { display: none; font-weight: 400; }
:host([chevron]) .headline .sub .chev { display: inline; }

/* ---- model menu ---- */
.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  min-width: 232px;
  max-width: min(340px, 92vw);
  max-height: 268px;
  overflow: auto;
  padding: 6px;
  border-radius: 14px;
  z-index: 9;
  background: var(--rs-surface);
  color: var(--rs-ink);
  border: 1px solid var(--rs-hairline);
  box-shadow: var(--rs-shadow);
  opacity: 0;
  visibility: hidden;
  transition: opacity .14s ease, transform .16s cubic-bezier(.34, 1.32, .64, 1);
}
:host([data-menu]) .menu { opacity: 1; visibility: visible; transform: translateX(-50%); }
.menu .group {
  padding: 7px 9px 3px;
  font-size: 10.5px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--rs-ink-dim);
}
.menu button.item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.menu button.item:hover,
.menu button.item[data-active] { background: var(--rs-hover); }
.menu button.item[aria-selected="true"] { font-weight: 600; }
.menu .tick { margin-left: auto; color: var(--rs-fill); opacity: 0; }
.menu button.item[aria-selected="true"] .tick { opacity: 1; }
.menu .empty { padding: 10px; font-size: 12.5px; color: var(--rs-ink-dim); }
:host([card]) .track {
  grid-column: 1;
  grid-row: 2;
  width: 100%;
  margin-top: 12px;
}

/* ======================= headline (non-card too) ======================= */
.headline { display: none; flex-direction: column; align-items: center; gap: 1px; text-align: center; }
:host([headline]) .headline { display: flex; }
:host([headline]) .meter, :host([headline]) .caption { display: none; }
.headline .title { font-size: 15px; font-weight: 700; line-height: 1.25; color: var(--rs-title); transition: color .2s ease; }
:host([chevron]) .headline .sub .chev { display: inline; }

/* optional left-aligned "高级 ›" row */
.row { display: none; align-items: center; gap: 3px; font-size: 13px; font-weight: 600; color: var(--rs-ink); }
:host([rowlabel]) .row { display: inline-flex; }
.row .chev { color: var(--rs-ink-dim); font-weight: 400; display: none; }
:host([chevron]) .row .chev { display: inline; }

:host([stretch]) { display: flex; width: 100%; }
:host([stretch]) .root { width: 100%; }
:host([stretch]) .stack { flex: 1; width: 100%; }
:host([stretch]) .track { width: 100%; }

/* ============================== the capsule ============================== */
.track {
  position: relative;
  width: var(--rs-track-width, 240px);
  height: var(--rs-track-height);
  flex: none;
  cursor: pointer;
  border-radius: 999px;
}
.rail { position: absolute; inset: 0; border-radius: inherit; background: var(--rs-rail); }
:host([variant="plain"]) .rail { top: 50%; height: 5px; margin-top: -2.5px; }

/* Stop dots are opt-in: they are off by default (the plain reference look was
   requested), and adding the dots attribute brings the tier markers back. */
.dots { display: none; position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
:host([dots]) .dots { display: block; }
.dot {
  position: absolute;
  top: 50%;
  /* each dot carries its own --rs-pct, so this must not go through the
     inherited --rs-thumb-x (which is already substituted for the live value) */
  left: calc(var(--rs-pad) + (100% - 2 * var(--rs-pad)) * var(--rs-pct) / 100);
  width: var(--rs-dot-size);
  height: var(--rs-dot-size);
  margin: calc(var(--rs-dot-size) / -2) 0 0 calc(var(--rs-dot-size) / -2);
  border-radius: 50%;
  background: var(--rs-dot);
  transition: background-color .18s ease;
}
.fill .dots .dot { background: var(--rs-dot-on); }
:host([variant="plain"]) .dots { display: none; }

.fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  clip-path: inset(0 calc(100% - var(--rs-thumb-x)) 0 0 round 999px);
  transition: clip-path .22s cubic-bezier(.3, .9, .3, 1);
}
:host([variant="plain"]) .fill { top: 50%; height: 5px; margin-top: -2.5px; }
:host([data-dragging]) .fill { transition: none; }
.paint { position: absolute; inset: 0; background: var(--rs-fill); transition: background .24s ease; }
:host([variant="plain"]) .paint { background: var(--dsw-alias-brand-primary, #d97757); }
/* second-highest tier: the fill only warms toward violet at its leading edge */
:host([data-tier="soft"]) .paint {
  background: linear-gradient(90deg, var(--rs-fill) 0%, var(--rs-fill) 52%, var(--rs-stop-2) 88%, var(--rs-stop-3) 100%);
}
:host([data-tier="top"]) .paint { background: var(--rs-gradient); }

.sparks { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; display: none; }
:host([data-tier="top"]:not([variant="plain"])) .sparks,
:host([data-tier="soft"]:not([variant="plain"])) .sparks { display: block; }
/* Soft tier: only the fine field shows — smaller, denser dust that twinkles
   gently, so "more strength" reads as finer grain rather than a hard flash. */
.sparks .spark.fine { display: none; }
:host([data-tier="soft"]) .sparks .spark:not(.fine) { display: none; }
:host([data-tier="soft"]) .sparks .spark.fine { display: block; }

/* Both tiers are phased by #phaseSparks, so the wave always starts at the left
   of the filled span and runs right, into the white disc. The top tier flashes
   hard and fast; the tier below drifts the same way through its fine dust. */
:host([data-tier="top"]) .sparks .spark {
  animation: rs-sweep var(--rs-sweep, 1.9s) linear infinite;
  animation-delay: calc(var(--rs-sweep, 1.9s) * var(--sweep-frac, 0) * -1);
}
:host([data-tier="top"]) .sparks .spark.glow { animation-name: rs-sweep-glow; }
:host([data-tier="soft"]) .sparks .spark.fine {
  animation: rs-fine calc(var(--rs-sweep, 1.9s) * 2.4) ease-in-out infinite;
  animation-delay: calc(var(--rs-sweep, 1.9s) * 2.4 * var(--sweep-frac, 0) * -1);
}
@keyframes rs-sweep {
  0%   { opacity: calc(var(--o, .8) * .18); transform: translateX(2px) scale(.5); }
  5%   { opacity: 1; transform: translateX(0) scale(1.42); }
  17%  { opacity: calc(var(--o, .8) * .8); transform: translateX(-1px) scale(1); }
  100% { opacity: calc(var(--o, .8) * .26); transform: translateX(-2.5px) scale(.62); }
}
@keyframes rs-sweep-glow {
  0%   { opacity: calc(var(--o, .8) * .18); transform: translateX(2px) scale(.5); box-shadow: none; }
  5%   { opacity: 1; transform: translateX(0) scale(1.6); box-shadow: 0 0 7px 2px #ffffffcc; }
  17%  { opacity: calc(var(--o, .8) * .8); transform: translateX(-1px) scale(1); box-shadow: 0 0 4px 1px #ffffff8c; }
  100% { opacity: calc(var(--o, .8) * .26); transform: translateX(-2.5px) scale(.62); box-shadow: none; }
}
/* gentle: a shallow swell in the fine dust, released leftward */
@keyframes rs-fine {
  0%   { opacity: calc(var(--o, .6) * .4); transform: translateX(1px) scale(.82); }
  22%  { opacity: calc(var(--o, .6) * 1.4); transform: translateX(0) scale(1.25); }
  60%  { opacity: calc(var(--o, .6) * .75); transform: translateX(-.7px) scale(1); }
  100% { opacity: calc(var(--o, .6) * .45); transform: translateX(-1.4px) scale(.86); }
}
.sparks .spark {
  position: absolute;
  left: var(--x); top: var(--y);
  width: var(--s); height: var(--s);
  margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
  border-radius: 50%;
  background: #fff;
  opacity: var(--o, .8);
  animation: rs-twinkle var(--d, 3.4s) ease-in-out var(--delay, 0s) infinite;
}
.sparks .spark.glow { box-shadow: 0 0 4px 1px #ffffff80; }
@keyframes rs-twinkle {
  0%, 100% { opacity: calc(var(--o, .8) * .5); transform: scale(.78); }
  50%      { opacity: var(--o, .8); transform: scale(1); }
}

.thumb {
  position: absolute;
  top: 50%;
  left: var(--rs-thumb-x);
  width: var(--rs-thumb-size);
  height: var(--rs-thumb-size);
  margin: calc(var(--rs-thumb-size) / -2) 0 0 calc(var(--rs-thumb-size) / -2);
  border-radius: 50%;
  background: var(--rs-thumb);
  box-shadow: var(--rs-ring);
  transition: transform .18s cubic-bezier(.34, 1.32, .64, 1), left .22s cubic-bezier(.3, .9, .3, 1), box-shadow .2s ease;
}
:host([data-dragging]) .thumb {
  transform: scale(1.06);
  box-shadow: var(--rs-ring), 0 0 0 6px color-mix(in srgb, var(--rs-fill) 18%, transparent);
  transition: transform .12s ease, box-shadow .12s ease;
}
:host([busy]) .thumb { animation: rs-pulse 1.15s ease-in-out infinite; }
@keyframes rs-pulse {
  0%, 100% { box-shadow: var(--rs-ring); }
  50%      { box-shadow: var(--rs-ring), 0 0 0 9px color-mix(in srgb, var(--rs-fill) 16%, transparent); }
}

/* ============================== meter + caption ============================== */
.meter { display: inline-flex; align-items: flex-end; gap: 2px; height: 13px; width: 15px; flex: none; }
.meter i { flex: 1; border-radius: 1.5px; background: var(--rs-rail); transition: background-color .2s ease, height .24s cubic-bezier(.34,1.32,.64,1); }
.meter i:nth-child(1) { height: 5px; }
.meter i:nth-child(2) { height: 9px; }
.meter i:nth-child(3) { height: 13px; }
.meter i.on { background: var(--rs-fill); }
:host([data-tier="top"]) .meter i.on { background: linear-gradient(180deg, var(--rs-stop-2), var(--rs-stop-3)); }

.stack { display: inline-flex; flex-direction: column; gap: 7px; min-width: 0; }
.caption { font-size: 12px; line-height: 1; color: var(--rs-title); white-space: nowrap; min-width: 34px; transition: color .2s ease; }

/* ============================== hover bubble ============================== */
.tip {
  position: absolute; bottom: calc(100% + 8px); left: 50%;
  transform: translate(-50%, 3px);
  min-width: max-content; max-width: 240px;
  padding: 4px 8px; border-radius: 7px;
  background: var(--dsw-alias-tooltip-bg, #141413);
  color: var(--dsw-static-neutral-bluish-00, #fff);
  font-size: 11.5px; line-height: 15px;
  box-shadow: 0 4px 14px rgb(0 0 0 / .26);
  opacity: 0; pointer-events: none; z-index: 4;
  transition: opacity .14s ease, transform .18s cubic-bezier(.34, 1.32, .64, 1);
}
.tip b { font-weight: 600; }
.tip em { font-style: normal; opacity: .72; }
.tip em::before { content: " · "; }
:host([data-hover]) .tip, :host([data-dragging]) .tip { opacity: 1; transform: translate(-50%, 0); }
:host([data-note="none"]) .tip em { display: none; }

/* ============================== expanded ============================== */
:host([expanded]) { display: flex; width: 100%; height: auto; flex-direction: column; align-items: stretch; gap: 6px; }
:host([expanded]) .root { padding: 4px 8px 2px; }
:host([expanded]) .stack { width: 100%; }
:host([expanded]) .track { width: 100%; }
:host([expanded]) .caption { display: none; }
.scale { display: none; justify-content: space-between; padding: 0 var(--rs-pad) 2px; font-size: 11px; color: var(--rs-ink-dim); }
:host([expanded]) .scale { display: flex; }
.scale span { transition: color .18s ease; }
.scale span.on { color: var(--rs-ink); font-weight: 600; }

@media (prefers-reduced-motion: reduce) {
  .fill, .thumb, .dot, .paint, .tip { transition: opacity .12s ease; }
  .sparks .spark, :host([busy]) .thumb { animation: none; }
}
`;

const TEMPLATE = `
<div class="root" part="root">
  <span class="headline">
    <b class="title"></b>
    <button class="sub" part="model" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="subtext"></span><i class="chev">›</i>
    </button>
  </span>
  <div class="menu" part="menu" role="listbox" aria-label="切换模型"></div>
  <span class="meter" aria-hidden="true"><i></i><i></i><i></i></span>
  <span class="stack">
    <span class="row"><b class="rowlabel"></b><i class="chev">›</i></span>
    <span class="track" part="track">
      <span class="rail"></span>
      <span class="dots"></span>
      <span class="fill"><span class="paint"></span><span class="sparks"></span><span class="dots"></span></span>
      <span class="thumb" part="thumb"></span>
    </span>
  </span>
  <span class="caption" part="caption"></span>
  <span class="tip" role="presentation"><b></b><em></em></span>
</div>
<div class="scale" part="scale"></div>
`;

/** Deterministic PRNG so the sparkle field is stable across renders. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Cheap equality for model-menu rows, so a re-render does not rebuild the DOM. */
function sameRows(a, b) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => row.provider === b[index].provider
    && row.model === b[index].model
    && row.label === b[index].label
    && row.providerLabel === b[index].providerLabel
    && row.current === b[index].current);
}

export class ReasoningSlider extends HTMLElement {
  static observedAttributes = [
    "value", "levels", "disabled", "busy", "compact", "expanded", "variant", "card",
    "headline", "subtitle", "chevron", "rowlabel", "stretch", "spark-tier", "label",
  ];
  #levels = [];
  #models = [];
  #value = "";
  #pointerId = null;
  #livePct = null;
  #hoverIndex = null;
  #track;
  #fill;
  #thumb;
  #caption;
  #rowLabel;
  #headlineTitle;
  #headlineSub;
  #subButton;
  #menu;
  #menuOpen = false;
  #tipTitle;
  #tipNote;
  #sparks;
  #fields = [];
  #phasePct = -1;
  #railDots;
  #fillDots;
  #scale;
  #dotCount = -1;
  #meterBars = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${STYLE}</style>${TEMPLATE}`;
    this.#track = shadow.querySelector(".track");
    this.#fill = shadow.querySelector(".fill");
    this.#thumb = shadow.querySelector(".thumb");
    this.#caption = shadow.querySelector(".caption");
    this.#rowLabel = shadow.querySelector(".rowlabel");
    this.#headlineTitle = shadow.querySelector(".headline .title");
    this.#headlineSub = shadow.querySelector(".headline .subtext");
    this.#subButton = shadow.querySelector(".headline .sub");
    this.#menu = shadow.querySelector(".menu");
    this.#tipTitle = shadow.querySelector(".tip b");
    this.#tipNote = shadow.querySelector(".tip em");
    this.#sparks = shadow.querySelector(".sparks");
    this.#railDots = shadow.querySelector(".track > .dots");
    this.#fillDots = shadow.querySelector(".fill .dots");
    this.#scale = shadow.querySelector(".scale");
    this.#meterBars = [...shadow.querySelectorAll(".meter i")];
    this.#buildSparks();
    // No host attributes here: a custom element constructor that adds attributes
    // makes `document.createElement` throw NotSupportedError, and the DSH seat
    // builds this element exactly that way.
  }

  connectedCallback() {
    if (!this.hasAttribute("role")) this.setAttribute("role", "slider");
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    if (!this.hasAttribute("compact") && !this.hasAttribute("expanded") && !this.hasAttribute("card")) this.setAttribute("compact", "");
    this.#track.addEventListener("pointerdown", this.#onPointerDown);
    this.#track.addEventListener("pointermove", this.#onPointerMove);
    this.#track.addEventListener("pointerleave", this.#onPointerLeave);
    this.#track.addEventListener("pointerup", this.#onPointerUp);
    this.#track.addEventListener("pointercancel", this.#onPointerUp);
    this.addEventListener("keydown", this.#onKeyDown);
    this.#subButton.addEventListener("click", this.#onSubClick);
    this.#render();
  }

  disconnectedCallback() {
    this.#track.removeEventListener("pointerdown", this.#onPointerDown);
    this.#track.removeEventListener("pointermove", this.#onPointerMove);
    this.#track.removeEventListener("pointerleave", this.#onPointerLeave);
    this.#track.removeEventListener("pointerup", this.#onPointerUp);
    this.#track.removeEventListener("pointercancel", this.#onPointerUp);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#subButton.removeEventListener("click", this.#onSubClick);
    this.#openMenu(false);
  }

  attributeChangedCallback(name, previous, next) {
    if (name === "levels") {
      try {
        const parsed = JSON.parse(next ?? "[]");
        this.#levels = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.#levels = [];
      }
    }
    if (name === "value" && next !== null) this.#value = next;
    this.#render();
  }

  get levels() { return this.#levels; }
  set levels(next) {
    this.#levels = Array.isArray(next) ? next.map((level) => ({ ...level })) : [];
    this.#render();
  }

  get value() { return this.#value; }
  set value(next) {
    const id = next === undefined || next === null ? "" : String(next);
    if (id === this.#value) return;
    this.#value = id;
    this.#render();
  }

  /** Index of {@link value} in {@link levels}, or -1. */
  get index() {
    const found = this.#levels.findIndex((level) => String(level.id ?? "") === this.#value);
    if (found >= 0) return found;
    const fallback = this.#levels.findIndex((level) => String(level.id ?? "") === "");
    return fallback >= 0 ? fallback : this.#levels.length === 0 ? -1 : 0;
  }

  /** Move to one index without a pointer, emitting the change event. */
  select(index, { silent = false } = {}) {
    const clamped = Math.max(0, Math.min(this.#levels.length - 1, index));
    const level = this.#levels[clamped];
    if (level === undefined) return;
    const id = String(level.id ?? "");
    if (id === this.#value) return;
    this.#value = id;
    this.#render();
    if (!silent) {
      this.dispatchEvent(new CustomEvent("reasoning-change", {
        detail: { id, label: level.label ?? id, index: clamped, level },
        bubbles: true,
        composed: true,
      }));
    }
  }

  /**
   * Second headline line — the host's model name. Exposed as a property as well
   * as an attribute, because the plugin glue and demo pages assign it directly.
   */
  get subtitle() {
    return this.getAttribute("subtitle") ?? "";
  }

  set subtitle(next) {
    if (next === null || next === undefined || next === "") this.removeAttribute("subtitle");
    else this.setAttribute("subtitle", String(next));
  }

  /**
   * Rows for the model menu, supplied by the host:
   *   [{ provider, providerLabel?, model, label?, current? }]
   * Clicking the subtitle line opens the list; picking a row emits
   * "reasoning-model-change" so the host can run its own model selection.
   */
  get models() {
    return this.#models;
  }

  set models(next) {
    const rows = Array.isArray(next) ? next.map((row) => ({ ...row })) : [];
    if (sameRows(this.#models, rows)) return;
    this.#models = rows;
    this.#buildMenu();
  }

  /** Rebuild the menu rows from {@link models}. */
  #buildMenu() {
    const groups = new Map();
    for (const row of this.#models) {
      const key = row.providerLabel ?? row.provider ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const fragment = document.createDocumentFragment();
    if (this.#models.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "没有可切换的模型";
      fragment.appendChild(empty);
    }
    for (const [label, rows] of groups) {
      const head = document.createElement("div");
      head.className = "group";
      head.textContent = label;
      fragment.appendChild(head);
      for (const row of rows) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "item";
        item.setAttribute("role", "option");
        item.dataset.provider = row.provider ?? "";
        item.dataset.model = row.model ?? "";
        item.setAttribute("aria-selected", row.current === true ? "true" : "false");
        const text = document.createElement("span");
        text.textContent = row.label ?? row.model ?? "";
        const tick = document.createElement("span");
        tick.className = "tick";
        tick.textContent = "✓";
        item.append(text, tick);
        item.addEventListener("click", () => this.#pickModel(item));
        fragment.appendChild(item);
      }
    }
    this.#menu.replaceChildren(fragment);
    this.#subButton.disabled = this.#models.length < 2;
    // Any known model keeps the chip visible, even when there is nothing to pick.
    this.toggleAttribute("data-model-chip", this.#models.length >= 1);
  }

  #onSubClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.#openMenu(this.#menuOpen === false);
  };

  /** Show or hide the model menu, wiring the document-level guards while open. */
  #openMenu(open) {
    if (open === true && this.#subButton.disabled === true) return;
    this.#menuOpen = open === true;
    this.toggleAttribute("data-menu", this.#menuOpen);
    this.#subButton.setAttribute("aria-expanded", this.#menuOpen ? "true" : "false");
    if (this.#menuOpen) {
      const current = this.#menu.querySelector('button.item[aria-selected="true"]');
      this.#setActive(current ?? this.#menu.querySelector("button.item"));
      document.addEventListener("pointerdown", this.#onDocumentPointerDown, true);
      document.addEventListener("keydown", this.#onMenuKeyDown, true);
    } else {
      document.removeEventListener("pointerdown", this.#onDocumentPointerDown, true);
      document.removeEventListener("keydown", this.#onMenuKeyDown, true);
      for (const item of this.#menu.querySelectorAll("button.item")) item.removeAttribute("data-active");
    }
  }

  #setActive(element) {
    for (const item of this.#menu.querySelectorAll("button.item")) item.toggleAttribute("data-active", item === element);
    element?.focus?.();
  }

  #onDocumentPointerDown = (event) => {
    if (event.composedPath().includes(this) === false) this.#openMenu(false);
  };

  #onMenuKeyDown = (event) => {
    const items = [...this.#menu.querySelectorAll("button.item")];
    if (items.length === 0) {
      if (event.key === "Escape") this.#openMenu(false);
      return;
    }
    const index = items.findIndex((item) => item.hasAttribute("data-active"));
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        this.#openMenu(false);
        this.#subButton.focus();
        return;
      case "ArrowDown":
        event.preventDefault();
        this.#setActive(items[Math.min(items.length - 1, Math.max(0, index) + 1)]);
        return;
      case "ArrowUp":
        event.preventDefault();
        this.#setActive(items[Math.max(0, Math.min(index, items.length - 1) - 1)]);
        return;
      case "Enter":
        if (index >= 0) {
          event.preventDefault();
          this.#pickModel(items[index]);
        }
        return;
      default:
    }
  };

  #pickModel(item) {
    this.#openMenu(false);
    this.#subButton.focus();
    this.dispatchEvent(new CustomEvent("reasoning-model-change", {
      detail: { provider: item.dataset.provider ?? "", model: item.dataset.model ?? "" },
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Build the two sparkle fields once; positions stay put across renders.
   *
   *   · the main field (SPARK_COUNT) carries the top tier's hard sweep;
   *   · the fine field (FINE_COUNT) is smaller and denser and carries the tier
   *     below, whose strength reads as a gentle twinkle in fine dust.
   *
   * Both fields keep their x, and #render() re-phases them from the thumb, so
   * the flashes always leave the disc and travel left.
   */
  #buildSparks() {
    const random = seededRandom(0x5eed1234);
    const fragments = document.createDocumentFragment();
    this.#fields = [];
    for (let index = 0; index < SPARK_COUNT + FINE_COUNT; index += 1) {
      const fine = index >= SPARK_COUNT;
      const spark = document.createElement("span");
      spark.className = fine ? "spark fine" : "spark";
      const glow = fine === false && index % 5 === 0;
      if (glow) spark.classList.add("glow");
      // Tighter bands than a uniform scatter, so a dense field reads as dust
      // rather than as a longer line.
      const x = 3 + random() * 94;
      spark.style.setProperty("--x", `${x.toFixed(2)}%`);
      spark.style.setProperty("--y", `${(18 + random() * 62).toFixed(2)}%`);
      spark.style.setProperty("--s", fine
        ? `${(0.5 + random() * 0.8).toFixed(2)}px`
        : `${(0.6 + random() * (glow ? 1.5 : 0.9)).toFixed(2)}px`);
      spark.style.setProperty("--o", (fine ? 0.3 + random() * 0.4 : 0.4 + random() * 0.45).toFixed(2));
      spark.style.setProperty("--d", `${(2.4 + random() * 2.2).toFixed(2)}s`);
      spark.style.setProperty("--delay", `${(random() * 3.2).toFixed(2)}s`);
      // A little jitter keeps the wave from reading as a straight vertical line.
      this.#fields.push({ element: spark, x, jitter: (random() - 0.5) * 0.1 });
      fragments.appendChild(spark);
    }
    this.#sparks.replaceChildren(fragments);
    this.#phaseSparks(0, true);
  }

  /**
   * Re-phase both fields so the flash travels left → right across the filled
   * span: a spark at the far left flashes now, one at the thumb a full period
   * later, which makes the band run toward the white disc.
   */
  #phaseSparks(pct, force = false) {
    if (force === false && Math.abs(pct - this.#phasePct) < 0.4) return;
    this.#phasePct = pct;
    const span = Math.max(1, pct);
    for (const field of this.#fields) {
      const frac = field.x / span + field.jitter;
      const clamped = Math.min(1, Math.max(0, frac));
      field.element.style.setProperty("--sweep-frac", clamped.toFixed(3));
    }
  }

  /** Rebuild both stop-dot layers when the stop count changes (opt-in via `dots`). */
  #buildDots(count) {
    const wanted = this.hasAttribute("dots") ? count : 0;
    if (this.#dotCount === wanted) return;
    this.#dotCount = wanted;
    const rail = document.createDocumentFragment();
    const fill = document.createDocumentFragment();
    for (let index = 0; index < wanted; index += 1) {
      const railDot = document.createElement("span");
      railDot.className = "dot";
      railDot.style.setProperty("--rs-pct", this.#pctOf(index).toFixed(4));
      rail.appendChild(railDot);
      const fillDot = document.createElement("span");
      fillDot.className = "dot";
      fillDot.style.setProperty("--rs-pct", this.#pctOf(index).toFixed(4));
      fill.appendChild(fillDot);
    }
    this.#railDots.replaceChildren(rail);
    this.#fillDots.replaceChildren(fill);
    this.#scale.replaceChildren(...this.#levels.map((level) => {
      const span = document.createElement("span");
      span.textContent = level.label ?? String(level.id ?? "");
      return span;
    }));
  }

  #indexAt(clientX) {
    const rect = this.#track.getBoundingClientRect();
    const pad = this.#pad();
    const inner = Math.max(1, rect.width - pad * 2);
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left - pad) / inner));
    return Math.round(ratio * Math.max(1, this.#levels.length - 1));
  }

  #ratioAt(clientX) {
    const rect = this.#track.getBoundingClientRect();
    const pad = this.#pad();
    const inner = Math.max(1, rect.width - pad * 2);
    return Math.max(0, Math.min(1, (clientX - rect.left - pad) / inner));
  }

  /** Track inset = half a thumb, matching the CSS `--rs-pad`. */
  #pad() {
    const size = Number.parseFloat(getComputedStyle(this).getPropertyValue("--rs-thumb-size"));
    if (Number.isFinite(size) && size > 0) return size / 2;
    return this.#track.getBoundingClientRect().height / 2;
  }

  #pctOf(index) {
    const count = this.#levels.length;
    if (count <= 1) return 0;
    return (index / (count - 1)) * 100;
  }

  #onPointerDown = (event) => {
    if (this.hasAttribute("disabled") || this.#levels.length < 2) return;
    event.preventDefault();
    this.#pointerId = event.pointerId;
    this.#track.setPointerCapture(event.pointerId);
    this.setAttribute("data-dragging", "");
    this.#hoverIndex = this.#indexAt(event.clientX);
    this.#livePct = this.#pctOf(this.#hoverIndex);
    this.#render();
    this.focus({ preventScroll: true });
  };

  #onPointerMove = (event) => {
    if (this.#levels.length < 2) return;
    const ratio = this.#ratioAt(event.clientX);
    this.#hoverIndex = Math.round(ratio * Math.max(1, this.#levels.length - 1));
    if (this.#pointerId === null) {
      this.setAttribute("data-hover", "");
      this.#render();
      return;
    }
    if (event.pointerId !== this.#pointerId) return;
    this.#livePct = ratio * 100;
    this.#render();
  };

  #onPointerLeave = () => {
    if (this.#pointerId !== null) return;
    this.#hoverIndex = null;
    this.removeAttribute("data-hover");
    this.#render();
  };

  #onPointerUp = (event) => {
    if (this.#pointerId === null || event.pointerId !== this.#pointerId) return;
    const index = this.#indexAt(event.clientX);
    this.#pointerId = null;
    this.#livePct = null;
    this.#hoverIndex = null;
    try {
      this.#track.releasePointerCapture(event.pointerId);
    } catch {}
    this.removeAttribute("data-dragging");
    this.removeAttribute("data-hover");
    this.select(index);
    this.#render();
  };

  #onKeyDown = (event) => {
    if (this.hasAttribute("disabled")) return;
    const count = this.#levels.length;
    if (count < 2) return;
    const current = this.index;
    let next = null;
    switch (event.key) {
      case "ArrowRight": case "ArrowUp": next = current + 1; break;
      case "ArrowLeft": case "ArrowDown": next = current - 1; break;
      case "Home": next = 0; break;
      case "End": next = count - 1; break;
      case "PageUp": next = current + 1; break;
      case "PageDown": next = current - 1; break;
      default:
        if (/^[1-9]$/.test(event.key)) next = Number(event.key) - 1;
    }
    if (next === null) return;
    event.preventDefault();
    this.select(next);
  };

  #render() {
    const count = this.#levels.length;
    const active = this.index;
    const pct = this.#pointerId !== null && this.#livePct !== null ? this.#livePct : this.#pctOf(active);
    this.style.setProperty("--rs-pct", pct.toFixed(3));
    // Re-phase the sparkle fields so their flash band starts at the thumb.
    this.#phaseSparks(pct);

    this.#buildDots(count);

    const level = this.#levels[active];
    // Spark tiers: `spark: true` = the full Ultra look, `spark: "soft"` = the
    // gentle violet glow. With no explicit flags the last stop takes the full
    // look and the one before it the soft one, so a four-tier model maps to
    // 轻度 / 中 / 高(soft) / 极高(top).
    const declared = this.#levels.some((candidate) => candidate?.spark === true || candidate?.spark === "soft");
    const auto = declared === false && this.getAttribute("spark-tier") !== "off" && count >= 2;
    const tier = level?.spark === true ? "top"
      : level?.spark === "soft" ? "soft"
      : auto === false ? ""
      : active === count - 1 ? "top"
      : (count >= 3 && active === count - 2) ? "soft"
      : "";
    if (tier === "") this.removeAttribute("data-tier");
    else this.setAttribute("data-tier", tier);

    const label = level ? (level.label ?? String(level.id ?? "")) : "";
    this.#caption.textContent = label;
    this.#headlineTitle.textContent = label;
    this.#headlineSub.textContent = this.getAttribute("subtitle") ?? "";
    const lit = count <= 1 ? count : 1 + Math.round((Math.max(0, active) / (count - 1)) * 2);
    this.#meterBars.forEach((bar, index) => bar.classList.toggle("on", index < lit));

    const rowLabel = this.getAttribute("rowlabel");
    if (rowLabel !== null) this.#rowLabel.textContent = rowLabel || "高级";
    [...this.#scale.children].forEach((span, index) => span.classList.toggle("on", index === active));

    const hovered = this.#hoverIndex !== null ? this.#levels[this.#hoverIndex] : level;
    this.#tipTitle.textContent = hovered?.label ?? "";
    const note = hovered?.note;
    this.#tipNote.textContent = note ?? "";
    this.setAttribute("data-note", note ? "yes" : "none");

    this.setAttribute("aria-label", this.getAttribute("label") ?? "推理等级");
    this.setAttribute("aria-valuemin", "0");
    this.setAttribute("aria-valuemax", String(Math.max(0, count - 1)));
    this.setAttribute("aria-valuenow", String(Math.max(0, active)));
    this.setAttribute("aria-valuetext", label);
    if (this.hasAttribute("busy")) this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");
  }
}

if (!customElements.get(REASONING_SLIDER_TAG)) {
  customElements.define(REASONING_SLIDER_TAG, ReasoningSlider);
}

export default ReasoningSlider;
