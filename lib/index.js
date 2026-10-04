/**
 * Host half of the reasoning-slider plugin.
 *
 * The contribution is entirely client-side: the composer seat, its slider, and
 * the wiring to `modelDirectories` all live in `lib/client.js`, which DSH
 * discovers through this package's `exports["./client"]` because `dsh.client`
 * declares `platform: "web"`. This module exists so the profile row resolves to
 * a real package and so the bundle patch has a host entry to register.
 *
 * @module reasoning-slider
 */

/** Plugin name, matching this package's bundle row id. */
export const name = "reasoning-slider";

/** Nothing to do host-side; the client half owns every contribution. */
export function apply() {}

export default { name, apply };
