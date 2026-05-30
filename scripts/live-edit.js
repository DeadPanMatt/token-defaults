import {
  MODULE_ID,
  FIELD_DEFS,
  SECTIONS,
  applyField,
  readFieldValue
} from "./constants.js";
import { applyConflictDisable } from "./conflict-detection.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const MIXED = "__token-presets:mixed__";

export class LiveEditForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "token-presets-live-edit",
    tag: "form",
    classes: ["token-presets", "token-presets-live-edit"],
    window: {
      title: "TOKEN_PRESETS.LiveEdit.title",
      icon: "fa-solid fa-pen-to-square",
      resizable: true
    },
    position: { width: 560, height: 640 },
    form: {
      handler: LiveEditForm.#onSubmit,
      closeOnSubmit: false,
      submitOnChange: false
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/live-edit.hbs`,
      scrollable: [".live-edit-body"]
    },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  #tokens = [];
  #initial = new Map();
  #originalSnapshots = new Map();
  #committed = false;
  #onPreviewChange = () => this.#previewChanges();

  constructor(tokens, options = {}) {
    super(options);
    this.#tokens = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
    this.#snapshotOriginal();
  }

  #snapshotOriginal() {
    for (const td of this.#tokens) {
      const snap = {};
      for (const def of Object.values(FIELD_DEFS)) {
        const paths = def.paths ?? (def.path ? [def.path] : []);
        for (const path of paths) {
          const v = foundry.utils.getProperty(td, path);
          snap[path] = v instanceof Set ? Array.from(v) : foundry.utils.deepClone(v);
        }
      }
      this.#originalSnapshots.set(td.id, snap);
    }
  }

  async _prepareContext(_options) {
    this.#initial.clear();

    const sections = [];
    for (const sectionId of Object.keys(SECTIONS)) {
      const fields = [];
      for (const [key, def] of Object.entries(FIELD_DEFS)) {
        if ((def.section ?? "appearance") !== sectionId) continue;
        fields.push(this.#buildFieldContext(key, def));
      }
      if (fields.length) {
        sections.push({
          id: sectionId,
          label: SECTIONS[sectionId]?.label ?? sectionId,
          hint: SECTIONS[sectionId]?.hint ?? null,
          fields
        });
      }
    }

    return {
      tokenCount: this.#tokens.length,
      sections,
      buttons: [
        {
          type: "submit",
          icon: "fa-solid fa-check",
          label: "TOKEN_PRESETS.LiveEdit.apply"
        }
      ]
    };
  }

  #buildFieldContext(key, def) {
    const values = this.#tokens.map((t) => readFieldValue(def, t));
    const mixed = !this.#allEqual(values, def.type);
    const sample = mixed ? def.default : (values[0] ?? def.default);

    const ctx = {
      key,
      label: def.label,
      hint: def.hint ?? null,
      type: def.type,
      plain: !!def.plain,
      mixed,
      value: sample,
      min: def.min,
      max: def.max,
      step: def.step
    };

    if (def.type === "select") {
      this.#initial.set(key, mixed ? MIXED : sample);
      const constMap = def.options();
      ctx.choices = Object.entries(constMap).map(([name, val]) => ({
        value: val,
        label: name,
        selected: !mixed && val === sample
      }));
    } else if (def.type === "flags") {
      const flagsMap = def.options?.() ?? {};
      const perBitState = Object.entries(flagsMap).map(([name, bit]) => {
        const present = this.#tokens.map((t) => this.#tokenHasFlag(def, t, name, bit));
        const allOn = present.every(Boolean);
        const allOff = present.every((p) => !p);
        return {
          name,
          bit,
          label: localizeFlagLabel(name),
          state: allOn ? "on" : allOff ? "off" : "mixed"
        };
      });
      ctx.choices = perBitState;
      this.#initial.set(
        key,
        Object.fromEntries(perBitState.map((c) => [c.name, c.state]))
      );
    } else {
      this.#initial.set(key, mixed ? MIXED : sample);
    }

    return ctx;
  }

  #tokenHasFlag(def, token, name, bit) {
    const v = readFieldValue(def, token);
    if (Array.isArray(v)) return v.includes(name);
    if (v instanceof Set) return v.has(name);
    if (typeof v === "number") return (v & bit) === bit;
    return false;
  }

  #allEqual(values, type) {
    if (values.length <= 1) return true;
    if (type === "flags") {
      const norm = (v) => {
        if (Array.isArray(v)) return JSON.stringify([...v].sort());
        if (v instanceof Set) return JSON.stringify([...v].sort());
        return JSON.stringify(v);
      };
      const first = norm(values[0]);
      return values.every((v) => norm(v) === first);
    }
    const first = values[0];
    return values.every((v) => v === first);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const cb of this.element.querySelectorAll(
      'input[type="checkbox"][data-mixed="true"]'
    )) {
      cb.indeterminate = true;
    }
    applyConflictDisable(this.element);
    this.element.addEventListener("change", this.#onPreviewChange);
    this.element.addEventListener("input", this.#onPreviewChange);
  }

  #computeDirty() {
    if (!this.element) return { scalarChanges: new Map(), flagDecisions: new Map() };
    const FDE = foundry.applications?.ux?.FormDataExtended ?? FormDataExtended;
    const formData = new FDE(this.element).object;
    const expanded = foundry.utils.expandObject(formData ?? {});
    const fields = expanded.fields ?? {};
    const rootEl = this.element;

    const scalarChanges = new Map();
    const flagDecisions = new Map();

    for (const [key, def] of Object.entries(FIELD_DEFS)) {
      if (def.type === "flags") {
        const decisions = this.#readFlagDecisions(key, def, rootEl);
        if (decisions?.anyExplicit) flagDecisions.set(key, decisions);
        continue;
      }
      const change = this.#scalarFieldChange(key, def, fields, rootEl);
      if (change.changed) scalarChanges.set(key, change.value);
    }

    return { scalarChanges, flagDecisions };
  }

  #previewChanges() {
    const { scalarChanges, flagDecisions } = this.#computeDirty();

    for (const tokenDoc of this.#tokens) {
      this.#restoreOne(tokenDoc);

      const update = {};
      let hasChange = false;
      for (const [key, value] of scalarChanges) {
        const def = FIELD_DEFS[key];
        applyField(def, value, update, null, tokenDoc);
        hasChange = true;
      }
      for (const [key, decisions] of flagDecisions) {
        const def = FIELD_DEFS[key];
        const resolved = this.#resolveFlagsForToken(def, decisions, tokenDoc);
        applyField(def, resolved, update, null, tokenDoc);
        hasChange = true;
      }

      if (hasChange) {
        try {
          tokenDoc.updateSource(update);
        } catch (err) {
          console.error(`${MODULE_ID} | preview updateSource failed`, err);
        }
      }
      this.#refreshOne(tokenDoc);
    }
  }

  #restoreOne(tokenDoc) {
    const snap = this.#originalSnapshots.get(tokenDoc.id);
    if (!snap) return;
    const update = {};
    for (const [path, value] of Object.entries(snap)) {
      foundry.utils.setProperty(update, path, value);
    }
    try {
      tokenDoc.updateSource(update);
    } catch (err) {
      console.error(`${MODULE_ID} | restore updateSource failed`, err);
    }
  }

  #refreshOne(tokenDoc) {
    tokenDoc.object?.draw?.().catch(() => {});
  }

  #revertAllAndRefresh() {
    for (const tokenDoc of this.#tokens) {
      this.#restoreOne(tokenDoc);
      this.#refreshOne(tokenDoc);
    }
  }

  static async #onSubmit(_event, _form, _formData) {
    const { scalarChanges, flagDecisions } = this.#computeDirty();

    if (!scalarChanges.size && !flagDecisions.size) {
      ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.LiveEdit.noChanges"));
      return;
    }

    const confirmed = await DialogV2.confirm({
      window: {
        title: game.i18n.localize("TOKEN_PRESETS.LiveEdit.confirmTitle"),
        icon: "fa-solid fa-circle-question"
      },
      content: `<p>${game.i18n.format("TOKEN_PRESETS.LiveEdit.confirmMessage", { count: this.#tokens.length })}</p>`,
      rejectClose: false
    }).catch(() => false);

    if (!confirmed) return;

    this.#revertAllAndRefresh();

    const updatesByScene = new Map();
    for (const tokenDoc of this.#tokens) {
      const scene = tokenDoc.parent;
      if (!scene) continue;

      const update = { _id: tokenDoc.id };
      let hasChange = false;
      for (const [key, value] of scalarChanges) {
        const def = FIELD_DEFS[key];
        applyField(def, value, update, null, tokenDoc);
        hasChange = true;
      }
      for (const [key, decisions] of flagDecisions) {
        const def = FIELD_DEFS[key];
        const resolved = this.#resolveFlagsForToken(def, decisions, tokenDoc);
        applyField(def, resolved, update, null, tokenDoc);
        hasChange = true;
      }

      if (!hasChange) continue;
      const arr = updatesByScene.get(scene) ?? [];
      arr.push(update);
      updatesByScene.set(scene, arr);
    }

    let totalUpdated = 0;
    try {
      for (const [scene, updates] of updatesByScene) {
        await scene.updateEmbeddedDocuments("Token", updates);
        totalUpdated += updates.length;
      }
      this.#committed = true;
    } catch (err) {
      console.error(`${MODULE_ID} | live edit persist failed`, err);
      ui.notifications?.error(game.i18n.localize("TOKEN_PRESETS.LiveEdit.applyFailed"));
      return;
    }

    ui.notifications?.info(
      game.i18n.format("TOKEN_PRESETS.LiveEdit.done", { count: totalUpdated })
    );
    await this.close();
  }

  async close(options = {}) {
    if (!this.#committed) {
      this.#revertAllAndRefresh();
    }
    return super.close(options);
  }

  #scalarFieldChange(key, def, submittedFields, rootEl) {
    const initial = this.#initial.get(key);
    const submitted = submittedFields[key];

    if (def.type === "boolean") {
      const cb = rootEl.querySelector(
        `input[type="checkbox"][name="fields.${key}.value"]`
      );
      if (!cb || cb.indeterminate) return { changed: false };
      const value = !!cb.checked;
      if (initial !== MIXED && value === initial) return { changed: false };
      return { changed: true, value };
    }

    if (def.type === "select") {
      const raw = submitted?.value;
      if (raw === undefined || raw === "" || raw === MIXED) return { changed: false };
      const isString = def.valueType === "string";
      const value = isString ? raw : Number(raw);
      if (initial !== MIXED) {
        const initialNorm = isString ? initial : Number(initial);
        if (value === initialNorm) return { changed: false };
      }
      return { changed: true, value };
    }

    if (def.type === "number") {
      const raw = submitted?.value;
      if (raw === undefined || raw === "") return { changed: false };
      const value = Number(raw);
      if (Number.isNaN(value)) return { changed: false };
      if (initial !== MIXED && value === Number(initial)) return { changed: false };
      return { changed: true, value };
    }

    if (def.type === "color" || def.type === "image") {
      const raw = submitted?.value;
      if (raw === undefined) return { changed: false };
      const value = raw === "" ? "" : raw;
      if (initial !== MIXED && value === initial) return { changed: false };
      if (initial === MIXED && value === "") return { changed: false };
      if (def.type === "image" && value && !/\.[a-z0-9]{2,5}$/i.test(value)) {
        return { changed: false };
      }
      return { changed: true, value };
    }

    return { changed: false };
  }

  #readFlagDecisions(key, def, rootEl) {
    const flagsMap = def.options?.() ?? {};
    const initialMap = this.#initial.get(key) ?? {};
    const decisions = {};
    let anyExplicit = false;
    for (const name of Object.keys(flagsMap)) {
      const cb = rootEl.querySelector(
        `input[type="checkbox"][name="fields.${key}.flags.${name}"]`
      );
      if (!cb) continue;
      if (cb.indeterminate) {
        decisions[name] = "leave";
      } else {
        const newState = cb.checked ? "on" : "off";
        decisions[name] = newState;
        if (newState !== initialMap[name]) anyExplicit = true;
      }
    }
    return { anyExplicit, decisions };
  }

  #resolveFlagsForToken(def, { decisions }, tokenDoc) {
    const flagsMap = def.options?.() ?? {};
    const out = [];
    for (const name of Object.keys(flagsMap)) {
      const decision = decisions[name];
      if (decision === "on") out.push(name);
      else if (decision === "off") continue;
      else if (this.#tokenHasFlag(def, tokenDoc, name, flagsMap[name])) out.push(name);
    }
    return out;
  }
}

function localizeFlagLabel(name) {
  const candidates = [
    `TOKEN.RING.EFFECTS.${name}`,
    `TOKEN.RING_EFFECTS.${name}`,
    `TOKEN.RingEffects.${name}`,
    `TOKEN_RING.EFFECTS.${name}`,
    `TOKEN_RING.effects.${name}`,
    `TOKEN.Ring.Effects.${name}`,
    `CANVAS.TokenRing.Effects.${name}`
  ];
  for (const key of candidates) {
    const localized = game.i18n.localize(key);
    if (localized && localized !== key) return localized;
  }
  return name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
