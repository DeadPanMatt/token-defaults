import { MODULE_ID, SETTINGS, FIELD_DEFS } from "./constants.js";

const NAMED_CONTROL_SELECTOR =
  "input[name], select[name], textarea[name], " +
  "multi-checkbox[name], range-picker[name], color-picker[name], file-picker[name]";

export function installConflictDetection() {
  Hooks.on("renderTokenConfig", onTokenConfigRender);
  Hooks.on("renderApplicationV2", (app, html) => {
    const cls = app?.constructor?.name ?? "";
    if (cls === "TokenConfig" || /^TokenConfig/.test(cls)) {
      onTokenConfigRender(app, html);
    }
  });
}

function onTokenConfigRender(_app, html) {
  if (!game.user?.isGM) return;
  const rootEl = html instanceof HTMLElement ? html : html?.[0] ?? null;
  if (!rootEl) return;

  const cache = foundry.utils.deepClone(
    game.settings.get(MODULE_ID, SETTINGS.MANAGED_FIELDS) ?? {}
  );
  let changed = false;

  for (const el of rootEl.querySelectorAll(NAMED_CONTROL_SELECTOR)) {
    const name = el.getAttribute("name");
    if (!name) continue;

    const isDisabled = el.hasAttribute("disabled") || el.disabled === true;

    if (isDisabled) {
      const tooltip = el.getAttribute("data-tooltip") || null;
      const prev = cache[name];
      if (!prev || prev.tooltip !== tooltip) {
        cache[name] = { tooltip, lastSeen: Date.now() };
        changed = true;
      } else {
        prev.lastSeen = Date.now();
      }
    } else if (cache[name]) {
      delete cache[name];
      changed = true;
    }
  }

  if (changed) {
    game.settings.set(MODULE_ID, SETTINGS.MANAGED_FIELDS, cache).catch((err) => {
      console.warn(`${MODULE_ID} | failed to persist managed-fields cache`, err);
    });
  }
}

export function applyConflictDisable(rootEl) {
  if (!rootEl) return;
  const cache = game.settings.get(MODULE_ID, SETTINGS.MANAGED_FIELDS) ?? {};
  if (!Object.keys(cache).length) return;

  for (const [key, def] of Object.entries(FIELD_DEFS)) {
    const paths = def.paths ?? (def.path ? [def.path] : []);
    if (!paths.length) continue;

    let hit = null;
    for (const path of paths) {
      if (cache[path]) {
        hit = cache[path];
        break;
      }
    }
    if (!hit) continue;

    const fragment = `.${key}.`;
    for (const el of rootEl.querySelectorAll(`[name*="${fragment}"]`)) {
      el.disabled = true;
      el.setAttribute("disabled", "");
      if (hit.tooltip) el.setAttribute("data-tooltip", hit.tooltip);
    }
  }
}
