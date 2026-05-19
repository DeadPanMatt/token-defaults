import {
  MODULE_ID,
  SETTINGS,
  FLAGS,
  FIELD_DEFS,
  BUILTIN_PRESETS,
  BUILTIN_FOUNDRY_DEFAULT_ID,
  getPresetById
} from "./constants.js";
import { PresetManager } from "./config-app.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTINGS.PRESETS, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Remembers the last preset chosen, used as the default selection when picking for a new actor.
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

  patchActorCreateDialog();
});

// Apply the actor's preset to a token at placement time.
Hooks.on("preCreateToken", (tokenDoc) => {
  const actor = tokenDoc.actor;
  if (!actor) return;

  const presetId = actor.getFlag(MODULE_ID, FLAGS.PRESET_ID);
  if (!presetId) return;

  const preset = getPresetById(presetId);
  if (!preset) return;

  const updates = {};
  for (const [key, def] of Object.entries(FIELD_DEFS)) {
    const f = preset.fields?.[key];
    if (!f) continue;
    applyField(def, f.value, updates, null, tokenDoc);
  }
  if (Object.keys(updates).length) tokenDoc.updateSource(updates);
});

/** A field's apply targets — supports either a single `path` or an array `paths`. */
function fieldPaths(def) {
  return def.paths ?? (def.path ? [def.path] : []);
}

/**
 * Apply one preset field's value to an in-progress update object.
 * Supports custom apply functions (for fields that don't map cleanly to a path,
 * e.g. mirror which composes with scale by sign-flipping).
 */
function applyField(def, value, updates, snapshot, doc) {
  if (typeof def.apply === "function") {
    def.apply(value, updates, snapshot, doc);
    return;
  }
  // Color and image fields write null instead of empty string so Foundry's
  // ColorField / FilePathField schemas accept the cleared state.
  let writeValue = value;
  if ((def.type === "color" || def.type === "image") && writeValue === "") {
    writeValue = null;
  }
  for (const path of fieldPaths(def)) {
    if (snapshot) snapshot[path] = foundry.utils.getProperty(doc, path);
    foundry.utils.setProperty(updates, path, writeValue);
  }
}

// Per-actor context menu: "Set Token Preset…" — register on every plausible hook name
// so this works across V12/V13 sidebar variants. addActorContextOption dedupes.
for (const hook of ["getActorContextOptions", "getActorDirectoryEntryContext"]) {
  Hooks.on(hook, (_appOrHtml, options) => addActorContextOption(options));
}

// Per-folder context menu: "Set Token Preset for All Actors…"
for (const hook of ["getFolderContextOptions", "getActorFolderContextOptions", "getActorDirectoryFolderContext"]) {
  Hooks.on(hook, (_appOrHtml, options) => addFolderContextOption(options));
}

// Token Controls toolbar button: "Apply Preset to Selection"
Hooks.on("getSceneControlButtons", (controls) => addTokenToolbarButton(controls));

const SNAPSHOT_KEY = "prePush";

function patchActorCreateDialog() {
  const docCls = CONFIG.Actor?.documentClass;
  if (!docCls?.createDialog) return;

  const original = docCls.createDialog;
  docCls.createDialog = async function patchedCreateDialog(data = {}, ...rest) {
    // Skip the picker for compendium-targeted creates (createOptions.pack)
    const targetingPack = rest.some((arg) => arg && typeof arg === "object" && "pack" in arg && arg.pack);
    if (targetingPack) return original.call(this, data, ...rest);

    const lastUsed = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID) || "";
    const choice = await pickPreset({
      promptText: game.i18n.localize("TOKEN_DEFAULTS.Picker.promptNew"),
      currentPresetId: lastUsed
    });

    /* Picker cancelled or closed → abort the whole create flow.*/
    if (choice === undefined || choice === null) return null;

    if (choice) {
      data = foundry.utils.deepClone(data);
      foundry.utils.setProperty(data, `flags.${MODULE_ID}.${FLAGS.PRESET_ID}`, choice);
      await game.settings.set(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, choice);
    }
    return original.call(this, data, ...rest);
  };
}

/* Context menu actions for existing actors and folders.                    */
function addActorContextOption(options) {
  if (!Array.isArray(options)) return;
  if (options.some((o) => o?.name === "TOKEN_DEFAULTS.Context.setPreset")) return;
  options.push({
    name: "TOKEN_DEFAULTS.Context.setPreset",
    icon: '<i class="fa-solid fa-user-gear"></i>',
    condition: () => game.user.isGM,
    callback: async (li) => {
      const actor = resolveActorFromContext(li);
      if (actor) await setPresetOnActor(actor);
    }
  });
  options.push({
    name: "TOKEN_DEFAULTS.Context.pushActor",
    icon: '<i class="fa-solid fa-arrows-rotate"></i>',
    condition: (li) => {
      if (!game.user.isGM) return false;
      const actor = resolveActorFromContext(li);
      return !!actor?.getFlag(MODULE_ID, FLAGS.PRESET_ID);
    },
    callback: async (li) => {
      const actor = resolveActorFromContext(li);
      if (actor) await pushPresetForActor(actor);
    }
  });
}

function addFolderContextOption(options) {
  if (!Array.isArray(options)) return;
  if (options.some((o) => o?.name === "TOKEN_DEFAULTS.Context.setFolderPreset")) return;
  options.push({
    name: "TOKEN_DEFAULTS.Context.setFolderPreset",
    icon: '<i class="fa-solid fa-user-gear"></i>',
    condition: (li) => {
      if (!game.user.isGM) return false;
      const folder = resolveFolderFromContext(li);
      return folder?.type === "Actor";
    },
    callback: async (li) => {
      const folder = resolveFolderFromContext(li);
      if (folder) await setPresetOnFolder(folder);
    }
  });
  options.push({
    name: "TOKEN_DEFAULTS.Context.pushFolder",
    icon: '<i class="fa-solid fa-arrows-rotate"></i>',
    condition: (li) => {
      if (!game.user.isGM) return false;
      const folder = resolveFolderFromContext(li);
      return folder?.type === "Actor";
    },
    callback: async (li) => {
      const folder = resolveFolderFromContext(li);
      if (folder) await pushPresetForFolder(folder);
    }
  });
}

function resolveActorFromContext(li) {
  const el = li instanceof HTMLElement ? li : li?.[0];
  const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
  return id ? game.actors.get(id) : null;
}

function resolveFolderFromContext(li) {
  const el = li instanceof HTMLElement ? li : li?.[0];
  const id = el?.dataset?.folderId ?? el?.dataset?.entryId ?? el?.dataset?.documentId;
  return id ? game.folders.get(id) : null;
}

async function setPresetOnActor(actor) {
  const current = actor.getFlag(MODULE_ID, FLAGS.PRESET_ID) ?? "";
  const choice = await pickPreset({
    promptText: game.i18n.format("TOKEN_DEFAULTS.Picker.promptExisting", { name: actor.name }),
    currentPresetId: current
  });
  if (choice === undefined || choice === null) return;
  if (choice) await actor.setFlag(MODULE_ID, FLAGS.PRESET_ID, choice);
  else await actor.unsetFlag(MODULE_ID, FLAGS.PRESET_ID);
}

async function setPresetOnFolder(folder) {
  const actors = collectFolderActors(folder);
  if (!actors.length) {
    ui.notifications?.info(game.i18n.localize("TOKEN_DEFAULTS.Folder.empty"));
    return;
  }

  const choice = await pickPreset({
    promptText: game.i18n.format("TOKEN_DEFAULTS.Picker.promptFolder", {
      name: folder.name,
      count: actors.length
    }),
    currentPresetId: ""
  });
  if (choice === undefined || choice === null) return;

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  const presetName = choice
    ? (presets[choice]?.name ?? choice)
    : game.i18n.localize("TOKEN_DEFAULTS.Picker.none");

  const { DialogV2 } = foundry.applications.api;
  const confirmed = await DialogV2.confirm({
    window: { title: game.i18n.localize("TOKEN_DEFAULTS.Folder.confirmTitle") },
    content: `<p>${escapeHTML(game.i18n.format("TOKEN_DEFAULTS.Folder.confirm", {
      count: actors.length,
      preset: presetName
    }))}</p><p class="hint">${escapeHTML(game.i18n.localize("TOKEN_DEFAULTS.Folder.note"))}</p>`,
    rejectClose: false
  }).catch(() => false);
  if (!confirmed) return;

  for (const actor of actors) {
    if (choice) await actor.setFlag(MODULE_ID, FLAGS.PRESET_ID, choice);
    else await actor.unsetFlag(MODULE_ID, FLAGS.PRESET_ID);
  }
  ui.notifications?.info(game.i18n.format("TOKEN_DEFAULTS.Folder.done", { count: actors.length }));
}

function collectFolderActors(folder) {
  const folderIds = new Set([folder.id]);
  const queue = [folder];
  while (queue.length) {
    const f = queue.shift();
    for (const child of f.children ?? []) {
      const cf = child?.folder ?? child;
      if (cf?.id && !folderIds.has(cf.id)) {
        folderIds.add(cf.id);
        queue.push(cf);
      }
    }
  }
  const result = [];
  for (const actor of game.actors) {
    if (actor.folder?.id && folderIds.has(actor.folder.id)) result.push(actor);
  }
  return result;
}

/* ------------------------------------------------------------------------ */
/* Push: write preset values onto already-placed token documents.            */
/* ------------------------------------------------------------------------ */

function addTokenToolbarButton(controls) {
  const tokenControl = Array.isArray(controls)
    ? controls.find((c) => c?.name === "token" || c?.name === "tokens")
    : (controls?.tokens ?? controls?.token);
  if (!tokenControl) return;

  const tool = {
    name: "token-defaults-apply-preset",
    title: "TOKEN_DEFAULTS.Tool.applyToSelection",
    icon: "fa-solid fa-user-gear",
    button: true,
    visible: !!game.user?.isGM,
    onChange: () => applyPresetToSelectedTokens()
  };

  if (Array.isArray(tokenControl.tools)) {
    if (!tokenControl.tools.some((t) => t?.name === tool.name)) tokenControl.tools.push(tool);
  } else if (tokenControl.tools && typeof tokenControl.tools === "object") {
    if (!tokenControl.tools[tool.name]) tokenControl.tools[tool.name] = tool;
  }
}

async function applyPresetToSelectedTokens() {
  const selected = canvas.tokens?.controlled ?? [];
  if (!selected.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_DEFAULTS.Push.noSelection"));
    return;
  }

  const lastUsed = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID) || "";
  const choice = await pickPreset({
    promptText: game.i18n.format("TOKEN_DEFAULTS.Picker.promptSelection", { count: selected.length }),
    currentPresetId: lastUsed
  });
  if (choice === undefined || choice === null) return; // user cancelled

  // None ("") falls back to the built-in Foundry Default preset.
  const presetId = choice || BUILTIN_FOUNDRY_DEFAULT_ID;
  const preset = getPresetById(presetId);
  if (!preset) return;

  const total = await pushPresetToTokens(preset, selected.map((t) => t.document), presetId);
  if (choice) await game.settings.set(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, choice);
  ui.notifications?.info(game.i18n.format("TOKEN_DEFAULTS.Push.done", { count: total }));
}

async function pushPresetForActor(actor) {
  const presetId = actor.getFlag(MODULE_ID, FLAGS.PRESET_ID);
  if (!presetId) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_DEFAULTS.Push.noFlag"));
    return;
  }
  const preset = getPresetById(presetId);
  if (!preset) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_DEFAULTS.Push.presetMissing"));
    return;
  }

  const placements = findPlacedTokensForActor(actor);
  if (!placements.length) {
    ui.notifications?.info(game.i18n.localize("TOKEN_DEFAULTS.Push.noPlacements"));
    return;
  }

  const confirmed = await confirmPush(
    game.i18n.format("TOKEN_DEFAULTS.Push.confirmActor", {
      preset: preset.name,
      count: placements.length,
      actor: actor.name
    })
  );
  if (!confirmed) return;

  const total = await pushPresetToTokens(preset, placements, presetId);
  ui.notifications?.info(game.i18n.format("TOKEN_DEFAULTS.Push.done", { count: total }));
}

async function pushPresetForFolder(folder) {
  const actors = collectFolderActors(folder);

  // Group placements by their actor's flagged preset id.
  const tokensByPreset = new Map();
  for (const actor of actors) {
    const pid = actor.getFlag(MODULE_ID, FLAGS.PRESET_ID);
    if (!pid || !getPresetById(pid)) continue;
    const placements = findPlacedTokensForActor(actor);
    if (!placements.length) continue;
    const arr = tokensByPreset.get(pid) ?? [];
    arr.push(...placements);
    tokensByPreset.set(pid, arr);
  }

  if (!tokensByPreset.size) {
    ui.notifications?.info(game.i18n.localize("TOKEN_DEFAULTS.Push.folderNoFlags"));
    return;
  }

  const totalCount = [...tokensByPreset.values()].reduce((s, a) => s + a.length, 0);
  const summary = [...tokensByPreset.entries()]
    .map(([pid, arr]) => `${getPresetById(pid)?.name ?? "?"} (${arr.length})`)
    .join(", ");

  const confirmed = await confirmPush(
    game.i18n.format("TOKEN_DEFAULTS.Push.confirmFolder", {
      count: totalCount,
      folder: folder.name,
      summary
    })
  );
  if (!confirmed) return;

  let total = 0;
  for (const [pid, arr] of tokensByPreset) {
    const preset = getPresetById(pid);
    if (preset) total += await pushPresetToTokens(preset, arr, pid);
  }
  ui.notifications?.info(game.i18n.format("TOKEN_DEFAULTS.Push.done", { count: total }));
}

function findPlacedTokensForActor(actor) {
  const result = [];
  for (const scene of game.scenes) {
    for (const td of scene.tokens) {
      if (td.actorId === actor.id) result.push(td);
    }
  }
  return result;
}

async function pushPresetToTokens(preset, tokenDocs, presetId) {
  const updatesByScene = new Map();
  for (const td of tokenDocs) {
    const scene = td.parent;
    if (!scene) continue;

    const update = { _id: td.id };
    const snapshot = {};
    let hasChange = false;
    for (const [key, def] of Object.entries(FIELD_DEFS)) {
      const f = preset.fields?.[key];
      if (!f) continue;
      applyField(def, f.value, update, snapshot, td);
      hasChange = true;
    }
    if (!hasChange) continue;

    foundry.utils.setProperty(update, `flags.${MODULE_ID}.${SNAPSHOT_KEY}`, {
      presetId,
      paths: snapshot,
      timestamp: Date.now()
    });

    const arr = updatesByScene.get(scene) ?? [];
    arr.push(update);
    updatesByScene.set(scene, arr);
  }

  let total = 0;
  for (const [scene, updates] of updatesByScene) {
    await scene.updateEmbeddedDocuments("Token", updates);
    total += updates.length;
  }
  return total;
}

async function confirmPush(message) {
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.confirm({
    window: { title: game.i18n.localize("TOKEN_DEFAULTS.Push.confirmTitle") },
    content:
      `<p>${escapeHTML(message)}</p>` +
      `<p class="hint">${escapeHTML(game.i18n.localize("TOKEN_DEFAULTS.Push.note"))}</p>`,
    rejectClose: false
  }).catch(() => false);
}

/* Shared preset picker dialog.                                              */
async function pickPreset({ promptText, currentPresetId = "" }) {
  const builtins = Object.values(BUILTIN_PRESETS);
  const userPresets = Object.values(game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {});
  if (!builtins.length && !userPresets.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_DEFAULTS.Picker.noPresets"));
    return null;
  }

  const opt = (p) =>
    `<option value="${escapeHTML(p.id)}"${p.id === currentPresetId ? " selected" : ""}>${escapeHTML(p.name)}</option>`;

  const noneSelected = !currentPresetId ? " selected" : "";
  const optionsHtml = [
    `<option value=""${noneSelected}>${escapeHTML(game.i18n.localize("TOKEN_DEFAULTS.Picker.none"))}</option>`,
    builtins.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_DEFAULTS.Picker.builtinGroup"))}">${builtins.map(opt).join("")}</optgroup>`
      : "",
    userPresets.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_DEFAULTS.Picker.customGroup"))}">${userPresets.map(opt).join("")}</optgroup>`
      : ""
  ].join("");

  const content = `
    <p>${escapeHTML(promptText)}</p>
    <div class="form-group">
      <label for="token-defaults-preset-picker">${escapeHTML(game.i18n.localize("TOKEN_DEFAULTS.Picker.label"))}</label>
      <select id="token-defaults-preset-picker" name="presetId">${optionsHtml}</select>
    </div>
  `;

  const { DialogV2 } = foundry.applications.api;
  return DialogV2.wait({
    window: {
      title: game.i18n.localize("TOKEN_DEFAULTS.Picker.title"),
      icon: "fa-solid fa-user-gear"
    },
    content,
    buttons: [
      {
        action: "apply",
        label: game.i18n.localize("TOKEN_DEFAULTS.Picker.apply"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button) => {
          const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
          const data = new FDE(button.form).object;
          return data.presetId ?? "";
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("TOKEN_DEFAULTS.Picker.cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
