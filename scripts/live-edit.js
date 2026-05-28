import {
  MODULE_ID,
  FIELD_DEFS,
  SECTIONS,
  applyField,
  readFieldValue
} from "./constants.js";
import { applyConflictDisable } from "./conflict-detection.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


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
      closeOnSubmit: true,
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

  constructor(tokens, options = {}) {
    super(options);
    this.#tokens = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
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
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = foundry.utils.expandObject(formData?.object ?? {});
    const fields = submitted.fields ?? {};
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

    if (!scalarChanges.size && !flagDecisions.size) {
      ui.notifications?.info(game.i18n.localize("TOKEN_PRESETS.LiveEdit.noChanges"));
      return;
    }

    const updatesByScene = new Map();
    let touched = 0;

    for (const tokenDoc of this.#tokens) {
      const scene = tokenDoc.parent;
      if (!scene) continue;

      const update = { _id: tokenDoc.id };
      for (const [key, value] of scalarChanges) {
        const def = FIELD_DEFS[key];
        applyField(def, value, update, null, tokenDoc);
      }

      for (const [key, decisions] of flagDecisions) {
        const def = FIELD_DEFS[key];
        const resolved = this.#resolveFlagsForToken(def, decisions, tokenDoc);
        applyField(def, resolved, update, null, tokenDoc);
      }

      touched++;
      const arr = updatesByScene.get(scene) ?? [];
      arr.push(update);
      updatesByScene.set(scene, arr);
    }

    let totalUpdated = 0;
    for (const [scene, updates] of updatesByScene) {
      await scene.updateEmbeddedDocuments("Token", updates);
      totalUpdated += updates.length;
    }
    ui.notifications?.info(
      game.i18n.format("TOKEN_PRESETS.LiveEdit.done", { count: totalUpdated })
    );
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

    if (def.type === "color") {
      const raw = submitted?.value;
      if (raw === undefined) return { changed: false };
      const value = raw === "" ? "" : raw;
      if (initial !== MIXED && value === initial) return { changed: false };
      if (initial === MIXED && value === "") return { changed: false };
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
