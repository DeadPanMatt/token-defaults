import {
  MODULE_ID,
  SETTINGS,
  FLAGS,
  FIELD_DEFS,
  BUILTIN_PRESETS,
  BUILTIN_FOUNDRY_DEFAULT_ID,
  getPresetById,
  applyField
} from "./constants.js";
import { PresetManager } from "./config-app.js";
import { LiveEditForm } from "./live-edit.js";

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
    name: "TOKEN_PRESETS.Menu.presetManager.name",
    label: "TOKEN_PRESETS.Menu.presetManager.label",
    hint: "TOKEN_PRESETS.Menu.presetManager.hint",
    icon: "fa-solid fa-user-gear",
    type: PresetManager,
    restricted: true
  });

  patchActorCreateDialog();
});

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


for (const hook of ["getActorContextOptions", "getActorDirectoryEntryContext"]) {
  Hooks.on(hook, (_appOrHtml, options) => addActorContextOption(options));
}

for (const hook of ["getFolderContextOptions", "getActorFolderContextOptions", "getActorDirectoryFolderContext"]) {
  Hooks.on(hook, (_appOrHtml, options) => addFolderContextOption(options));
}

Hooks.on("getSceneControlButtons", (controls) => addTokenToolbarButton(controls));

const SNAPSHOT_KEY = "prePush";

function patchActorCreateDialog() {
  const docCls = CONFIG.Actor?.documentClass;
  if (!docCls?.createDialog) return;

  const original = docCls.createDialog;
  docCls.createDialog = async function patchedCreateDialog(data = {}, ...rest) {
    const targetingPack = rest.some((arg) => arg && typeof arg === "object" && "pack" in arg && arg.pack);
    if (targetingPack) return original.call(this, data, ...rest);

    const lastUsed = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID) || "";
    const choice = await pickPreset({
      promptText: game.i18n.localize("TOKEN_PRESETS.Picker.promptNew"),
      currentPresetId: lastUsed
    });

    if (choice === undefined || choice === null) return null;

    if (choice) {
      data = foundry.utils.deepClone(data);
      foundry.utils.setProperty(data, `flags.${MODULE_ID}.${FLAGS.PRESET_ID}`, choice);
      await game.settings.set(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, choice);
    }
    return original.call(this, data, ...rest);
  };
}

function addActorContextOption(options) {
  if (!Array.isArray(options)) return;
  if (options.some((o) => o?.name === "TOKEN_PRESETS.Context.setPreset")) return;
  options.push({
    name: "TOKEN_PRESETS.Context.setPreset",
    icon: '<i class="fa-solid fa-user-gear"></i>',
    condition: () => game.user.isGM,
    callback: async (li) => {
      const actor = resolveActorFromContext(li);
      if (actor) await setPresetOnActor(actor);
    }
  });
  options.push({
    name: "TOKEN_PRESETS.Context.pushActor",
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
  if (options.some((o) => o?.name === "TOKEN_PRESETS.Context.setFolderPreset")) return;
  options.push({
    name: "TOKEN_PRESETS.Context.setFolderPreset",
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
    name: "TOKEN_PRESETS.Context.pushFolder",
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
    promptText: game.i18n.format("TOKEN_PRESETS.Picker.promptExisting", { name: actor.name }),
    currentPresetId: current
  });
  if (choice === undefined || choice === null) return;
  if (choice) await actor.setFlag(MODULE_ID, FLAGS.PRESET_ID, choice);
  else await actor.unsetFlag(MODULE_ID, FLAGS.PRESET_ID);
}

async function setPresetOnFolder(folder) {
  const actors = collectFolderActors(folder);
  if (!actors.length) {
    ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.Folder.empty"));
    return;
  }

  const choice = await pickPreset({
    promptText: game.i18n.format("TOKEN_PRESETS.Picker.promptFolder", {
      name: folder.name,
      count: actors.length
    }),
    currentPresetId: ""
  });
  if (choice === undefined || choice === null) return;

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  const presetName = choice
    ? (presets[choice]?.name ?? choice)
    : game.i18n.localize("TOKEN_PRESETS.Picker.none");

  const { DialogV2 } = foundry.applications.api;
  const confirmed = await DialogV2.confirm({
    window: { title: game.i18n.localize("TOKEN_PRESETS.Folder.confirmTitle") },
    content: `<p>${escapeHTML(game.i18n.format("TOKEN_PRESETS.Folder.confirm", {
      count: actors.length,
      preset: presetName
    }))}</p><p class="hint">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Folder.note"))}</p>`,
    rejectClose: false
  }).catch(() => false);
  if (!confirmed) return;

  for (const actor of actors) {
    if (choice) await actor.setFlag(MODULE_ID, FLAGS.PRESET_ID, choice);
    else await actor.unsetFlag(MODULE_ID, FLAGS.PRESET_ID);
  }
  ui.notifications?.info(game.i18n.format("TOKEN_PRESETS.Folder.done", { count: actors.length }));
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

function addTokenToolbarButton(controls) {
  const tokenControl = Array.isArray(controls)
    ? controls.find((c) => c?.name === "token" || c?.name === "tokens")
    : (controls?.tokens ?? controls?.token);
  if (!tokenControl) return;

  const tool = {
    name: "token-presets-landing",
    title: "TOKEN_PRESETS.Tool.openLanding",
    icon: "fa-solid fa-user-gear",
    button: true,
    visible: !!game.user?.isGM,
    onChange: () => openLandingDialog()
  };

  if (Array.isArray(tokenControl.tools)) {
    if (!tokenControl.tools.some((t) => t?.name === tool.name)) tokenControl.tools.push(tool);
  } else if (tokenControl.tools && typeof tokenControl.tools === "object") {
    if (!tokenControl.tools[tool.name]) tokenControl.tools[tool.name] = tool;
  }
}

async function applyPresetToSelectedTokens() {
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.MultiPicker.noScene"));
    return;
  }

  const tokens = [...scene.tokens];
  if (!tokens.length) {
    ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.MultiPicker.noTokens"));
    return;
  }

  const builtins = Object.values(BUILTIN_PRESETS);
  const userPresets = Object.values(game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {});
  if (!builtins.length && !userPresets.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.Picker.noPresets"));
    return;
  }

  const preselected = new Set((canvas.tokens?.controlled ?? []).map((t) => t.id));

  const sortedTokens = tokens
    .map((td) => ({
      id: td.id,
      actorId: td.actorId,
      name: td.name || td.actor?.name || game.i18n.localize("TOKEN_PRESETS.MultiPicker.unnamed"),
      actorName: td.actor?.name,
      disposition: td.disposition ?? 0,
      actorLink: !!td.actorLink,
      hidden: !!td.hidden
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lastUsed = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID) || "";
  const presetOpt = (p) =>
    `<option value="${escapeHTML(p.id)}"${p.id === lastUsed ? " selected" : ""}>${escapeHTML(p.name)}</option>`;
  const presetOptions = [
    `<option value=""${!lastUsed ? " selected" : ""}>${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.none"))}</option>`,
    builtins.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.builtinGroup"))}">${builtins.map(presetOpt).join("")}</optgroup>`
      : "",
    userPresets.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.customGroup"))}">${userPresets.map(presetOpt).join("")}</optgroup>`
      : ""
  ].join("");

  const tokenOptions = sortedTokens
    .map((t) => {
      const label =
        t.actorName && t.actorName !== t.name ? `${t.name} (${t.actorName})` : t.name;
      return `<option value="${escapeHTML(t.id)}"
        data-actor-id="${escapeHTML(t.actorId ?? "")}"
        data-disposition="${t.disposition}"
        data-actor-link="${t.actorLink}"
        data-hidden="${t.hidden}"
        ${preselected.has(t.id) ? "selected" : ""}>${escapeHTML(label)}</option>`;
    })
    .join("");

  const content = `
    <div class="form-group">
      <label for="token-presets-multi-preset">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.label"))}</label>
      <select id="token-presets-multi-preset" name="presetId">${presetOptions}</select>
    </div>
    <div class="token-presets-explorer">
      ${renderTokenFilterBlock()}
      <div class="explorer-splitter" aria-hidden="true"></div>
      <div class="form-group token-presets-token-list explorer-list-pane">
        <label for="token-presets-multi-tokens">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.MultiPicker.tokensLabel"))}</label>
        <input type="search" class="token-presets-search" placeholder="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Search.placeholder"))}"/>
        <select id="token-presets-multi-tokens" name="tokenIds" multiple size="14">${tokenOptions}</select>
        <p class="hint">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.MultiPicker.hint"))}</p>
      </div>
    </div>
  `;

  const dialogClass = "token-presets-multi-picker-dialog";
  let teardownFilter = () => {};
  let teardownSplitter = () => {};
  const renderHookId = Hooks.on("renderDialogV2", (app) => {
    if (!app.options.classes?.includes(dialogClass)) return;
    Hooks.off("renderDialogV2", renderHookId);
    const root = app.element;
    const tokenSel = root.querySelector("select[name='tokenIds']");
    const searchEl = root.querySelector("input.token-presets-search");
    const filterContainer = root.querySelector(".token-presets-token-filter-container");
    const splitterEl = root.querySelector(".explorer-splitter");
    if (!tokenSel) return;

    let tokenFilter = "";
    let searchTerm = "";
    const reapply = () => applyTokenFilterAndSearch(tokenSel, tokenFilter, searchTerm);

    teardownFilter = setupTokenFilterHandlers(root, (newFilter) => {
      tokenFilter = newFilter;
      reapply();
    });
    searchEl?.addEventListener("input", () => {
      searchTerm = searchEl.value;
      reapply();
    });
    teardownSplitter = setupSplitter(filterContainer, splitterEl);
  });

  const { DialogV2 } = foundry.applications.api;
  const result = await DialogV2.wait({
    window: {
      title: game.i18n.localize("TOKEN_PRESETS.MultiPicker.title"),
      icon: "fa-solid fa-user-gear",
      resizable: true
    },
    classes: [dialogClass],
    content,
    position: { width: 720 },
    buttons: [
      {
        action: "apply",
        label: game.i18n.localize("TOKEN_PRESETS.Picker.apply"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button) => {
          const presetEl = button.form.querySelector("select[name='presetId']");
          const tokenEl = button.form.querySelector("select[name='tokenIds']");
          const tokenIds = Array.from(tokenEl?.selectedOptions ?? []).map((o) => o.value);
          return { presetId: presetEl?.value ?? "", tokenIds };
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("TOKEN_PRESETS.Picker.cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });
  Hooks.off("renderDialogV2", renderHookId);
  teardownFilter();
  teardownSplitter();

  if (!result) return;
  if (!result.tokenIds?.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.MultiPicker.noTokensSelected"));
    return;
  }

  const tokenDocs = result.tokenIds
    .map((id) => scene.tokens.get(id))
    .filter((td) => td);
  if (!tokenDocs.length) return;

  const presetId = result.presetId || BUILTIN_FOUNDRY_DEFAULT_ID;
  const preset = getPresetById(presetId);
  if (!preset) return;

  const total = await pushPresetToTokens(preset, tokenDocs, presetId);
  if (result.presetId) await game.settings.set(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, result.presetId);
  ui.notifications?.info(game.i18n.format("TOKEN_PRESETS.Push.done", { count: total }));
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class LandingPage extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "token-presets-landing",
    classes: ["token-presets", "token-presets-landing-app"],
    tag: "div",
    window: {
      title: "TOKEN_PRESETS.Landing.title",
      icon: "fa-solid fa-user-gear",
      resizable: false
    },
    position: { width: 360, height: "auto" },
    actions: {
      manage: LandingPage.#onManage,
      applyTokens: LandingPage.#onApplyTokens,
      tagActors: LandingPage.#onTagActors,
      editLive: LandingPage.#onEditLive
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/landing.hbs` }
  };

  static async #onManage() {
    new PresetManager().render({ force: true });
  }

  static async #onApplyTokens() {
    await applyPresetToSelectedTokens();
  }

  static async #onTagActors() {
    await openTagActorsDialog();
  }

  static async #onEditLive() {
    await openLiveEditForm();
  }
}

let _landingInstance = null;

function openLandingDialog() {
  if (_landingInstance?.rendered) {
    _landingInstance.bringToTop?.();
    return;
  }
  _landingInstance = new LandingPage();
  _landingInstance.render({ force: true });
}

async function openLiveEditForm() {
  const controlled = canvas?.tokens?.controlled ?? [];
  const docs = controlled.map((t) => t.document).filter(Boolean);
  if (!docs.length) {
    const { DialogV2 } = foundry.applications.api;
    await DialogV2.prompt({
      window: {
        title: game.i18n.localize("TOKEN_PRESETS.LiveEdit.noSelectionTitle"),
        icon: "fa-solid fa-circle-info"
      },
      content: `<p>${escapeHTML(game.i18n.localize("TOKEN_PRESETS.LiveEdit.noSelection"))}</p>`,
      ok: { label: game.i18n.localize("TOKEN_PRESETS.LiveEdit.ok") },
      rejectClose: false
    }).catch(() => null);
    return;
  }
  new LiveEditForm(docs).render({ force: true });
}

function buildActorFolderTree() {
  const folders = [...game.folders].filter((f) => f.type === "Actor");
  const byParent = new Map();
  for (const f of folders) {
    const parentId = f.folder?.id ?? null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(f);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
  }
  const out = [];
  const walk = (parentId, depth) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ id: f.id, name: f.name, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function collectDescendantFolderIds(folderId) {
  const ids = new Set([folderId]);
  const queue = [folderId];
  while (queue.length) {
    const id = queue.shift();
    const folder = game.folders.get(id);
    if (!folder) continue;
    for (const child of folder.children ?? []) {
      const cf = child?.folder ?? child;
      if (cf?.id && !ids.has(cf.id)) {
        ids.add(cf.id);
        queue.push(cf.id);
      }
    }
  }
  return ids;
}

function renderFolderTreeHTML(selectedId, expandedIds) {
  const folders = [...game.folders].filter((f) => f.type === "Actor");
  const byParent = new Map();
  for (const f of folders) {
    const parentId = f.folder?.id ?? null;
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(f);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
  }

  const row = ({ id, name, depth, hasChildren, icon }) => {
    const isExpanded = expandedIds.has(id);
    const isSelected = id === selectedId;
    const toggle = hasChildren
      ? `<button type="button" class="folder-toggle${isExpanded ? " expanded" : ""}" data-action="toggleFolder" data-folder-id="${escapeHTML(id)}" aria-label="toggle"><i class="fa-solid fa-chevron-right"></i></button>`
      : `<span class="folder-toggle-spacer"></span>`;
    return `<div class="folder-row${isSelected ? " selected" : ""}" data-folder-id="${escapeHTML(id)}" style="padding-left:${depth * 1.1}em">${toggle}<button type="button" class="folder-name" data-action="selectFolder" data-folder-id="${escapeHTML(id)}"><i class="fa-solid ${icon}"></i><span>${escapeHTML(name)}</span></button></div>`;
  };

  const walk = (parentId, depth) => {
    let html = "";
    for (const f of byParent.get(parentId) ?? []) {
      const kids = byParent.get(f.id) ?? [];
      html += row({ id: f.id, name: f.name, depth, hasChildren: kids.length > 0, icon: "fa-folder" });
      if (expandedIds.has(f.id) && kids.length) html += walk(f.id, depth + 1);
    }
    return html;
  };

  return [
    row({ id: "", name: game.i18n.localize("TOKEN_PRESETS.Folder.all"), depth: 0, hasChildren: false, icon: "fa-bars" }),
    row({ id: "__uncategorized__", name: game.i18n.localize("TOKEN_PRESETS.Folder.uncategorized"), depth: 0, hasChildren: false, icon: "fa-circle-question" }),
    walk(null, 0)
  ].join("");
}

function renderTokenFilterBlock() {
  const t = (k) => escapeHTML(game.i18n.localize(`TOKEN_PRESETS.TokenFilter.${k}`));
  return `
    <div class="form-group token-presets-token-filter-container">
      <div class="filter-header">
        <label>${t("label")}</label>
      </div>
      <div class="filter-list">
        <button type="button" class="filter-item selected" data-filter="">
          <i class="fa-solid fa-asterisk"></i><span>${t("all")}</span>
        </button>
        <div class="filter-group-label">${t("dispositionLabel")}</div>
        <button type="button" class="filter-item" data-filter="disposition:-1">
          <i class="fa-solid fa-skull disposition-hostile"></i><span>${t("hostile")}</span>
        </button>
        <button type="button" class="filter-item" data-filter="disposition:0">
          <i class="fa-solid fa-circle disposition-neutral"></i><span>${t("neutral")}</span>
        </button>
        <button type="button" class="filter-item" data-filter="disposition:1">
          <i class="fa-solid fa-handshake disposition-friendly"></i><span>${t("friendly")}</span>
        </button>
        <button type="button" class="filter-item" data-filter="disposition:-2">
          <i class="fa-solid fa-mask disposition-secret"></i><span>${t("secret")}</span>
        </button>
        <div class="filter-group-label">${t("linkLabel")}</div>
        <button type="button" class="filter-item" data-filter="linked">
          <i class="fa-solid fa-link"></i><span>${t("linked")}</span>
        </button>
        <button type="button" class="filter-item" data-filter="unlinked">
          <i class="fa-solid fa-link-slash"></i><span>${t("unlinked")}</span>
        </button>
        <div class="filter-group-label">${t("visibilityLabel")}</div>
        <button type="button" class="filter-item" data-filter="visible">
          <i class="fa-solid fa-eye"></i><span>${t("visible")}</span>
        </button>
        <button type="button" class="filter-item" data-filter="hidden">
          <i class="fa-solid fa-eye-slash"></i><span>${t("hidden")}</span>
        </button>
      </div>
    </div>
  `;
}

function setupTokenFilterHandlers(rootEl, onChangeFilter) {
  const container = rootEl.querySelector(".token-presets-token-filter-container");
  if (!container) return () => {};
  const onClick = (event) => {
    const btn = event.target.closest(".filter-item");
    if (!btn || !container.contains(btn)) return;
    container.querySelectorAll(".filter-item.selected").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    onChangeFilter(btn.dataset.filter ?? "");
  };
  container.addEventListener("click", onClick);
  return () => container.removeEventListener("click", onClick);
}

function tokenOptionMatchesFilter(option, filter) {
  if (!filter) return true;
  if (filter.startsWith("disposition:")) {
    return Number(option.dataset.disposition) === Number(filter.split(":")[1]);
  }
  if (filter === "linked") return option.dataset.actorLink === "true";
  if (filter === "unlinked") return option.dataset.actorLink !== "true";
  if (filter === "visible") return option.dataset.hidden !== "true";
  if (filter === "hidden") return option.dataset.hidden === "true";
  return true;
}

function applyTokenFilterAndSearch(listEl, filter, searchTerm) {
  const needle = (searchTerm || "").toLowerCase().trim();
  for (const option of listEl.options) {
    const filterOk = tokenOptionMatchesFilter(option, filter);
    const searchOk = !needle || option.textContent.toLowerCase().includes(needle);
    const visible = filterOk && searchOk;
    option.hidden = !visible;
    option.disabled = !visible;
    if (!visible) option.selected = false;
  }
}

function renderFolderPickerBlock() {
  return `
    <div class="form-group token-presets-folder-tree-container">
      <div class="folder-tree-header">
        <label>${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Folder.filterLabel"))}</label>
        <button type="button" class="new-folder-button" data-action="newFolder">
          <i class="fa-solid fa-folder-plus"></i> ${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Folder.newFolder"))}
        </button>
      </div>
      <div class="folder-tree">${renderFolderTreeHTML("", new Set())}</div>
      <input type="hidden" name="folderId" value=""/>
    </div>
  `;
}

function setupFolderTreeHandlers(rootEl, onSelectFolder) {
  const container = rootEl.querySelector(".token-presets-folder-tree-container");
  if (!container) return () => {};
  const state = { selectedId: "", expandedIds: new Set() };
  const hiddenInput = container.querySelector("input[name='folderId']");
  const treeEl = container.querySelector(".folder-tree");
  const rerender = () => { treeEl.innerHTML = renderFolderTreeHTML(state.selectedId, state.expandedIds); };

  const onClick = async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target || !container.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    const action = target.dataset.action;
    const folderId = target.dataset.folderId ?? "";

    if (action === "toggleFolder") {
      if (state.expandedIds.has(folderId)) state.expandedIds.delete(folderId);
      else state.expandedIds.add(folderId);
      rerender();
    } else if (action === "selectFolder") {
      state.selectedId = folderId;
      if (hiddenInput) hiddenInput.value = folderId;
      rerender();
      onSelectFolder(folderId);
    } else if (action === "newFolder") {
      const parentId = state.selectedId && state.selectedId !== "__uncategorized__" ? state.selectedId : null;
      try {
        await Folder.implementation.createDialog({ type: "Actor", folder: parentId });
        if (parentId) state.expandedIds.add(parentId);
      } catch (err) {
        console.error(`${MODULE_ID} | folder createDialog failed`, err);
      }
    }
  };

  container.addEventListener("click", onClick);

  let openMenu = null;
  const closeMenu = () => {
    if (openMenu) {
      openMenu.remove();
      openMenu = null;
    }
  };
  const onContextMenu = (event) => {
    const row = event.target.closest(".folder-row");
    if (!row || !container.contains(row)) return;
    event.preventDefault();
    closeMenu();
    const rowFolderId = row.dataset.folderId ?? "";
    const parentId = rowFolderId && rowFolderId !== "__uncategorized__" ? rowFolderId : null;

    const menu = document.createElement("div");
    menu.className = "token-presets-folder-ctxmenu";
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.innerHTML = `
      <button type="button" data-ctx-action="newFolderHere">
        <i class="fa-solid fa-folder-plus"></i>
        <span>${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Folder.newFolderHere"))}</span>
      </button>
    `;
    document.body.appendChild(menu);
    openMenu = menu;

    menu.querySelector("[data-ctx-action='newFolderHere']").addEventListener("click", async () => {
      closeMenu();
      try {
        await Folder.implementation.createDialog({ type: "Actor", folder: parentId });
        if (parentId) state.expandedIds.add(parentId);
      } catch (err) {
        console.error(`${MODULE_ID} | folder createDialog failed`, err);
      }
    });

    setTimeout(() => {
      const outside = (ev) => {
        if (!menu.contains(ev.target)) {
          closeMenu();
          document.removeEventListener("mousedown", outside, true);
        }
      };
      document.addEventListener("mousedown", outside, true);
    }, 0);
  };
  container.addEventListener("contextmenu", onContextMenu);

  const onFolderChange = () => rerender();
  Hooks.on("createFolder", onFolderChange);
  Hooks.on("updateFolder", onFolderChange);
  Hooks.on("deleteFolder", onFolderChange);

  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("contextmenu", onContextMenu);
    closeMenu();
    Hooks.off("createFolder", onFolderChange);
    Hooks.off("updateFolder", onFolderChange);
    Hooks.off("deleteFolder", onFolderChange);
  };
}

function actorIdsInFolderFilter(folderId) {
  if (!folderId) return null;
  if (folderId === "__uncategorized__") {
    return new Set([...game.actors].filter((a) => !a.folder).map((a) => a.id));
  }
  const folderIds = collectDescendantFolderIds(folderId);
  return new Set(
    [...game.actors].filter((a) => a.folder && folderIds.has(a.folder.id)).map((a) => a.id)
  );
}

function applyFolderFilterToList(listEl, allowedActorIds, getActorIdForOption) {
  for (const option of listEl.options) {
    const actorId = getActorIdForOption(option);
    const allowed = !allowedActorIds || (actorId && allowedActorIds.has(actorId));
    option.hidden = !allowed;
    option.disabled = !allowed;
    if (!allowed) option.selected = false;
  }
}

function applyCombinedFilter(listEl, allowedActorIds, searchTerm, getActorIdForOption) {
  const needle = (searchTerm || "").toLowerCase().trim();
  for (const option of listEl.options) {
    const actorId = getActorIdForOption(option);
    const folderOk = !allowedActorIds || (actorId && allowedActorIds.has(actorId));
    const searchOk = !needle || option.textContent.toLowerCase().includes(needle);
    const visible = folderOk && searchOk;
    option.hidden = !visible;
    option.disabled = !visible;
    if (!visible) option.selected = false;
  }
}

function setupSplitter(treeContainer, splitterEl) {
  if (!treeContainer || !splitterEl) return () => {};
  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  const onDown = (e) => {
    dragging = true;
    startX = e.clientX;
    startWidth = treeContainer.offsetWidth;
    splitterEl.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const newWidth = Math.max(140, Math.min(560, startWidth + dx));
    treeContainer.style.flex = `0 0 ${newWidth}px`;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    splitterEl.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  splitterEl.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  return () => {
    splitterEl.removeEventListener("mousedown", onDown);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
}

async function openTagActorsDialog() {
  const actors = [...game.actors].sort((a, b) => a.name.localeCompare(b.name));
  if (!actors.length) {
    ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.TagActors.noActors"));
    return;
  }

  const builtins = Object.values(BUILTIN_PRESETS);
  const userPresets = Object.values(game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {});
  if (!builtins.length && !userPresets.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.Picker.noPresets"));
    return;
  }

  const lastUsed = game.settings.get(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID) || "";
  const presetOpt = (p) =>
    `<option value="${escapeHTML(p.id)}"${p.id === lastUsed ? " selected" : ""}>${escapeHTML(p.name)}</option>`;
  const presetOptions = [
    `<option value=""${!lastUsed ? " selected" : ""}>${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.none"))}</option>`,
    builtins.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.builtinGroup"))}">${builtins.map(presetOpt).join("")}</optgroup>`
      : "",
    userPresets.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.customGroup"))}">${userPresets.map(presetOpt).join("")}</optgroup>`
      : ""
  ].join("");

  const actorOptions = actors
    .map((a) => {
      const flaggedId = a.getFlag(MODULE_ID, FLAGS.PRESET_ID);
      const flaggedPreset = flaggedId ? getPresetById(flaggedId) : null;
      const suffix = flaggedPreset ? ` — ${flaggedPreset.name}` : "";
      return `<option value="${escapeHTML(a.id)}">${escapeHTML(a.name + suffix)}</option>`;
    })
    .join("");

  const content = `
    <div class="form-group">
      <label for="token-presets-tag-preset">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.label"))}</label>
      <select id="token-presets-tag-preset" name="presetId">${presetOptions}</select>
    </div>
    <div class="token-presets-explorer">
      ${renderFolderPickerBlock()}
      <div class="explorer-splitter" aria-hidden="true"></div>
      <div class="form-group token-presets-actor-list explorer-list-pane">
        <label for="token-presets-tag-actors">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.TagActors.actorsLabel"))}</label>
        <input type="search" class="token-presets-search" placeholder="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Search.placeholder"))}"/>
        <select id="token-presets-tag-actors" name="actorIds" multiple size="14">${actorOptions}</select>
        <p class="hint">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.TagActors.hint"))}</p>
      </div>
    </div>
  `;

  const dialogClass = "token-presets-tag-actors-dialog";
  let teardownTree = () => {};
  let teardownSplitter = () => {};
  const renderHookId = Hooks.on("renderDialogV2", (app) => {
    if (!app.options.classes?.includes(dialogClass)) return;
    Hooks.off("renderDialogV2", renderHookId);
    const root = app.element;
    const actorSel = root.querySelector("select[name='actorIds']");
    const searchEl = root.querySelector("input.token-presets-search");
    const treeContainer = root.querySelector(".token-presets-folder-tree-container");
    const splitterEl = root.querySelector(".explorer-splitter");
    if (!actorSel) return;

    let folderId = "";
    let searchTerm = "";
    const reapply = () => {
      const allowed = actorIdsInFolderFilter(folderId);
      applyCombinedFilter(actorSel, allowed, searchTerm, (opt) => opt.value || null);
    };

    teardownTree = setupFolderTreeHandlers(root, (newFolderId) => {
      folderId = newFolderId;
      reapply();
    });
    searchEl?.addEventListener("input", () => {
      searchTerm = searchEl.value;
      reapply();
    });
    teardownSplitter = setupSplitter(treeContainer, splitterEl);
  });

  const { DialogV2 } = foundry.applications.api;
  const result = await DialogV2.wait({
    window: {
      title: game.i18n.localize("TOKEN_PRESETS.TagActors.title"),
      icon: "fa-solid fa-tag",
      resizable: true
    },
    classes: [dialogClass],
    content,
    position: { width: 720 },
    buttons: [
      {
        action: "apply",
        label: game.i18n.localize("TOKEN_PRESETS.Picker.apply"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button) => {
          const presetEl = button.form.querySelector("select[name='presetId']");
          const actorEl = button.form.querySelector("select[name='actorIds']");
          const actorIds = Array.from(actorEl?.selectedOptions ?? []).map((o) => o.value);
          return { presetId: presetEl?.value ?? "", actorIds };
        }
      },
      {
        action: "cancel",
        label: game.i18n.localize("TOKEN_PRESETS.Picker.cancel"),
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });
  Hooks.off("renderDialogV2", renderHookId);
  teardownTree();
  teardownSplitter();

  if (!result) return;
  if (!result.actorIds?.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.TagActors.noActorsSelected"));
    return;
  }

  const presets = game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {};
  const presetName = result.presetId
    ? getPresetById(result.presetId)?.name ?? "?"
    : game.i18n.localize("TOKEN_PRESETS.Picker.none");

  let changed = 0;
  for (const actorId of result.actorIds) {
    const actor = game.actors.get(actorId);
    if (!actor) continue;
    if (result.presetId) await actor.setFlag(MODULE_ID, FLAGS.PRESET_ID, result.presetId);
    else await actor.unsetFlag(MODULE_ID, FLAGS.PRESET_ID);
    changed++;
  }
  if (result.presetId) await game.settings.set(MODULE_ID, SETTINGS.DEFAULT_PRESET_ID, result.presetId);
  ui.notifications?.info(game.i18n.format("TOKEN_PRESETS.TagActors.done", { count: changed, preset: presetName }));
}

async function pushPresetForActor(actor) {
  const presetId = actor.getFlag(MODULE_ID, FLAGS.PRESET_ID);
  if (!presetId) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.Push.noFlag"));
    return;
  }
  const preset = getPresetById(presetId);
  if (!preset) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.Push.presetMissing"));
    return;
  }

  const placements = findPlacedTokensForActor(actor);
  if (!placements.length) {
    ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.Push.noPlacements"));
    return;
  }

  const confirmed = await confirmPush(
    game.i18n.format("TOKEN_PRESETS.Push.confirmActor", {
      preset: preset.name,
      count: placements.length,
      actor: actor.name
    })
  );
  if (!confirmed) return;

  const total = await pushPresetToTokens(preset, placements, presetId);
  ui.notifications?.info(game.i18n.format("TOKEN_PRESETS.Push.done", { count: total }));
}

async function pushPresetForFolder(folder) {
  const actors = collectFolderActors(folder);

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
    ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.Push.folderNoFlags"));
    return;
  }

  const totalCount = [...tokensByPreset.values()].reduce((s, a) => s + a.length, 0);
  const summary = [...tokensByPreset.entries()]
    .map(([pid, arr]) => `${getPresetById(pid)?.name ?? "?"} (${arr.length})`)
    .join(", ");

  const confirmed = await confirmPush(
    game.i18n.format("TOKEN_PRESETS.Push.confirmFolder", {
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
  ui.notifications?.info(game.i18n.format("TOKEN_PRESETS.Push.done", { count: total }));
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
    window: { title: game.i18n.localize("TOKEN_PRESETS.Push.confirmTitle") },
    content:
      `<p>${escapeHTML(message)}</p>` +
      `<p class="hint">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Push.note"))}</p>`,
    rejectClose: false
  }).catch(() => false);
}

async function pickPreset({ promptText, currentPresetId = "" }) {
  const builtins = Object.values(BUILTIN_PRESETS);
  const userPresets = Object.values(game.settings.get(MODULE_ID, SETTINGS.PRESETS) ?? {});
  if (!builtins.length && !userPresets.length) {
    ui.notifications?.warn(game.i18n.localize("TOKEN_PRESETS.Picker.noPresets"));
    return null;
  }

  const opt = (p) =>
    `<option value="${escapeHTML(p.id)}"${p.id === currentPresetId ? " selected" : ""}>${escapeHTML(p.name)}</option>`;

  const noneSelected = !currentPresetId ? " selected" : "";
  const optionsHtml = [
    `<option value=""${noneSelected}>${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.none"))}</option>`,
    builtins.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.builtinGroup"))}">${builtins.map(opt).join("")}</optgroup>`
      : "",
    userPresets.length
      ? `<optgroup label="${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.customGroup"))}">${userPresets.map(opt).join("")}</optgroup>`
      : ""
  ].join("");

  const content = `
    <p>${escapeHTML(promptText)}</p>
    <div class="form-group">
      <label for="token-presets-preset-picker">${escapeHTML(game.i18n.localize("TOKEN_PRESETS.Picker.label"))}</label>
      <select id="token-presets-preset-picker" name="presetId">${optionsHtml}</select>
    </div>
  `;

  const { DialogV2 } = foundry.applications.api;
  return DialogV2.wait({
    window: {
      title: game.i18n.localize("TOKEN_PRESETS.Picker.title"),
      icon: "fa-solid fa-user-gear"
    },
    content,
    buttons: [
      {
        action: "apply",
        label: game.i18n.localize("TOKEN_PRESETS.Picker.apply"),
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
        label: game.i18n.localize("TOKEN_PRESETS.Picker.cancel"),
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
