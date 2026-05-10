import { MODULE_ID, SETTINGS, FLAGS, FIELD_DEFS } from "./constants.js";
import { PresetManager } from "./config-app.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTINGS.PRESETS, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.registerMenu(MODULE_ID, "presetManager", {
    name: "TOKEN_DEFAULTS.Menu.presetManager.name",
    label: "TOKEN_DEFAULTS.Menu.presetManager.label",
    hint: "TOKEN_DEFAULTS.Menu.presetManager.hint",
    icon: "fa-solid fa-user-gear",
    type: PresetManager,
    restricted: true
  });
});

// Tag new world actors with the currently-selected default preset, if any.
// Skipped for compendium actors and for actors that already carry a flag
// (e.g. duplicates, exports re-imported with their flag intact).
Hooks.on("preCreateActor", (actor, data, options, _userId) => {
  if (actor.pack) return;
  const existing = foundry.utils.getProperty(data, `flags.${MODULE_ID}.${FLAGS.PRESET_ID}`);
  if (existing) return;

  const presetId = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID);
  if (!presetId) return;

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  if (!presets[presetId]) return;

  actor.updateSource({ [`flags.${MODULE_ID}.${FLAGS.PRESET_ID}`]: presetId });
});

// Apply the actor's preset to a token at placement time.
Hooks.on("preCreateToken", (tokenDoc, _data, _options, _userId) => {
  const actor = tokenDoc.actor;
  if (!actor) return;

  const presetId = actor.getFlag(MODULE_ID, FLAGS.PRESET_ID);
  if (!presetId) return;

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  const preset = presets[presetId];
  if (!preset) return;

  const updates = {};
  for (const [key, def] of Object.entries(FIELD_DEFS)) {
    const f = preset.fields?.[key];
    if (f?.enabled) updates[def.path] = f.value;
  }
  if (Object.keys(updates).length) tokenDoc.updateSource(updates);
});

// Inject a "Default Preset" dropdown into the Actors sidebar header.
Hooks.on("renderActorDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  if (root.querySelector(`.${MODULE_ID}-picker`)) return;

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  const current = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID);

  const wrapper = document.createElement("div");
  wrapper.className = `${MODULE_ID}-picker`;

  const label = document.createElement("label");
  label.textContent = game.i18n.localize("TOKEN_DEFAULTS.Sidebar.label");
  wrapper.appendChild(label);

  const select = document.createElement("select");
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = game.i18n.localize("TOKEN_DEFAULTS.Sidebar.none");
  if (!current) noneOpt.selected = true;
  select.appendChild(noneOpt);

  for (const p of Object.values(presets)) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === current) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener("change", (ev) => {
    game.settings.set(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, ev.target.value);
  });
  wrapper.appendChild(select);

  const header = root.querySelector(".directory-header")
    ?? root.querySelector("header.directory-header")
    ?? root.querySelector("header")
    ?? root;
  header.appendChild(wrapper);
});
